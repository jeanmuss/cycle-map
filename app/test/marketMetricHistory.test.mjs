import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  dedupeMarketMetricRows,
  extractCryptoHistoryRows,
  extractJapanRateRows,
  selectIncrementalObservationRows,
} from "../scripts/market-metric-history-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "..", "..");
const persistScriptPath = resolve(workspaceRoot, "app/scripts/persist-market-metric-history.mjs");

test("ETF and corporate treasury observations retain source and independent cost dates", () => {
  const rows = extractCryptoHistoryRows({
    generatedAt: "2026-07-13T00:00:00Z",
    timestamps: { fetchedAt: "2026-07-13T00:00:00Z", transformedAt: "2026-07-13T00:01:00Z" },
    sources: { sosovalueEtf: "https://example.test/etf" },
    etf: { BTC: { source: "sosovalue", status: "available", daily: [{ date: "2026-07-10", netFlowUsd: 10 }] } },
    corporateTreasuries: {
      MSTR: {
        company: "Strategy", ticker: "MSTR", asset: "BTC", source: "sosovalue",
        history: [{ holdingsObservedAt: "2026-06-21", disclosedAt: "2026-06-22", holdings: 847363, sourceUrl: "https://www.strategy.com/example-8-k" }],
        costHistory: [{ costObservedAt: "2026-06-21", averageCostUsd: 75651, costBasisApproximate: true, sourceUrl: "https://www.strategy.com/example-8-k" }],
      },
      BMNR: {
        company: "BitMine", ticker: "BMNR", asset: "ETH", source: "SEC",
        history: [{ holdingsObservedAt: "2026-06-28T22:30:00Z", disclosedAt: "2026-07-06", holdings: 5742237, sourceUrl: "https://www.sec.gov/example-8-k" }],
        costHistory: [{ costObservedAt: "2026-02-28", averageCostUsd: 3794.255, sourceUrl: "https://www.sec.gov/example-10-q", averageCostMethod: "same_date_cost_basis" }],
      },
    },
  });
  const byMetric = Object.fromEntries(rows.map((item) => [item.metric_id, item]));
  assert.equal(byMetric["crypto.etf.BTC.net_flow_usd"].value, 10);
  assert.equal(byMetric["treasury.bmnr.eth_holdings"].observed_at, "2026-06-28T22:30:00.000Z");
  assert.equal(byMetric["treasury.bmnr.eth_average_cost_usd"].observed_at, "2026-02-28T00:00:00Z");
  assert.equal(byMetric["treasury.bmnr.eth_average_cost_usd"].source, "SEC EDGAR");
  assert.equal(byMetric["treasury.mstr.btc_average_cost_usd"].source, "Strategy official Form 8-K");
  assert.equal(byMetric["treasury.mstr.btc_average_cost_usd"].metadata.costBasisApproximate, true);
  assert.notEqual(byMetric["treasury.bmnr.eth_holdings"].source_key, byMetric["treasury.bmnr.eth_average_cost_usd"].source_key);
  assert.equal(byMetric["treasury.bmnr.eth_holdings"].last_checked_at, "2026-07-13T00:00:00.000Z");
});

test("Japan rate persistence uses real MOF observation dates without forward-filled duplicates", () => {
  const rows = extractJapanRateRows({
    fetchedAt: "2026-07-13T01:00:00Z",
    source: "Japan Ministry of Finance",
    sourceUrl: "https://example.test/jgb.csv",
    observations: [
      { date: "2026-07-09", value: 2.7 },
      { date: "2026-07-10", value: 2.8 },
    ],
  }, {});
  assert.deepEqual(rows.map((item) => item.observed_at), ["2026-07-09T00:00:00Z", "2026-07-10T00:00:00Z"]);
  assert.ok(rows.every((item) => item.metric_id === "macro.JGB10Y.value" && item.cadence === "daily"));
});

test("initial Japan rate persistence is bounded, then uses a short overlap window", () => {
  const rows = Array.from({ length: 800 }, (_, index) => ({
    observed_at: new Date(Date.UTC(2024, 0, 1 + index)).toISOString(),
  }));
  const initial = selectIncrementalObservationRows(rows, null, { initialBackfillDays: 400, overlapDays: 14 });
  const incremental = selectIncrementalObservationRows(rows, rows[780].observed_at, { initialBackfillDays: 400, overlapDays: 14 });
  assert.ok(initial.length <= 401 && initial.length > 390);
  assert.ok(incremental.length <= 34 && incremental.length >= 15);
});

test("market history deduplication is idempotent by metric, observation, and source", () => {
  const base = {
    metric_id: "macro.JGB10Y.value", observed_at: "2026-07-10T00:00:00Z", source_key: "mof", value: 1,
  };
  const rows = dedupeMarketMetricRows([base, { ...base, value: 2 }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, 2);
});

test("market metric migration denies browser roles and grants only service-side writes", async () => {
  const migration = await readFile(resolve(workspaceRoot, "supabase/migrations/20260713000000_market_metric_observations.sql"), "utf8");
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.market_metric_observations from anon, authenticated/);
  assert.match(migration, /grant select, insert, update on table public\.market_metric_observations to service_role/);
  assert.match(migration, /revoke all on function public\.log_market_metric_observation_revision\(\) from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant .*market_metric_observations to anon/);
});

test("market history persistence supports opaque keys and an explicit required mode", async () => {
  const source = await readFile(persistScriptPath, "utf8");
  assert.match(source, /key && !key\.startsWith\("sb_"\)/, "opaque secret keys must not be sent as bearer JWTs");
  assert.match(source, /CYCLE_MAP_REQUIRE_MARKET_HISTORY === "1"/);
  assert.match(source, /if \(historyRequired\) throw new Error\(detail\)/);
  assert.match(source, /initialBackfillDays: 400/);
  assert.match(source, /slice\(0, 500\)/, "provider errors written to CI logs must be bounded");
});
