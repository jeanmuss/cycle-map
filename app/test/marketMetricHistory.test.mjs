import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  dedupeMarketMetricRows,
  extractCryptoHistoryRows,
  extractJapanRateRows,
  hydrateCryptoDatasetFromRows,
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

test("crypto level history persists point-level provider provenance and quality", () => {
  const [row] = extractCryptoHistoryRows({
    generatedAt: "2026-07-16T02:00:00Z",
    timestamps: { fetchedAt: "2026-07-16T01:00:00Z", transformedAt: "2026-07-16T02:00:00Z" },
    metrics: [{ id: "stablecoin.usdt.marketCap", unit: "USD", source: "cmc", semantics: "circulating_supply_proxy" }],
    history: {
      "stablecoin.usdt.marketCap": [{
        date: "2026-07-15",
        observedAt: "2026-07-15T00:00:00Z",
        value: 180,
        source: "defillama",
        sourceUrl: "https://api-docs.defillama.com/",
        fetchedAt: "2026-07-16T00:30:00Z",
        qualityStatus: "provider_reported_circulating_usd",
        metadata: { providerAssetId: "1" },
      }],
    },
  });
  assert.equal(row.source, "defillama");
  assert.equal(row.source_key, "defillama");
  assert.equal(row.source_url, "https://api-docs.defillama.com/");
  assert.equal(row.quality_status, "provider_reported_circulating_usd");
  assert.equal(row.fetched_at, "2026-07-16T00:30:00.000Z");
  assert.equal(row.last_checked_at, "2026-07-16T00:30:00.000Z");
  assert.equal(row.metadata.providerAssetId, "1");
});

test("unknown legacy level fetch times stay null when another provider refreshed the dataset", () => {
  const [row] = extractCryptoHistoryRows({
    generatedAt: "2026-07-16T02:00:00Z",
    timestamps: { fetchedAt: "2026-07-16T01:00:00Z", transformedAt: "2026-07-16T02:00:00Z" },
    metrics: [{ id: "btc.marketCap", unit: "USD", source: "existing-static-cache" }],
    history: { "btc.marketCap": [{ date: "2026-07-10", value: 1_000, source: "existing-static-cache" }] },
  });
  assert.equal(row.fetched_at, null);
  assert.equal(row.last_checked_at, null);
});

test("daily level identity stays at UTC midnight when the provider timestamp changes intraday", () => {
  const dataset = (sourceObservedAt) => ({
    metrics: [{ id: "btc.marketCap", unit: "USD", source: "cmc" }],
    history: {
      "btc.marketCap": [{
        date: "2026-07-10",
        observedAt: sourceObservedAt,
        value: 1_000,
        source: "cmc",
      }],
    },
  });
  const [first] = extractCryptoHistoryRows(dataset("2026-07-10T00:04:00Z"));
  const [revised] = extractCryptoHistoryRows(dataset("2026-07-10T23:59:00Z"));
  assert.equal(first.observed_at, "2026-07-10T00:00:00.000Z");
  assert.equal(revised.observed_at, first.observed_at);
  assert.equal(first.metadata.sourceObservedAt, "2026-07-10T00:04:00.000Z");
  assert.equal(revised.metadata.sourceObservedAt, "2026-07-10T23:59:00.000Z");
});

test("database hydration restores level and ETF history without filling gaps", () => {
  const base = {
    version: 4,
    generatedAt: "2026-07-10T00:00:00Z",
    timestamps: { fetchedAt: "2026-07-10T00:00:00Z", transformedAt: "2026-07-10T00:00:00Z" },
    sectionObservedAt: { etf: null },
    metrics: [
      { id: "crypto.totalMarketCap", value: 2_000, observedAt: "2026-07-10T00:00:00Z", source: "cmc", unit: "USD" },
      { id: "stablecoin.usdc.marketCap", value: null, observedAt: null, source: "pending-cmc-refresh", unit: "USD" },
    ],
    history: {},
    etf: { BTC: { asset: "BTC", status: "pending_credentials", daily: [], weekly: [] } },
    corporateTreasuries: {
      MSTR: {
        company: "Strategy",
        ticker: "MSTR",
        asset: "BTC",
        source: "Strategy official Form 8-K",
        holdings: 120,
        holdingsObservedAt: "2026-07-10",
        history: [{ disclosedAt: "2026-07-10", holdingsObservedAt: "2026-07-10", holdings: 120 }],
      },
      BMNR: {
        company: "BitMine",
        ticker: "BMNR",
        asset: "ETH",
        source: "SEC EDGAR company disclosures",
        holdings: 220,
        holdingsObservedAt: "2026-07-10",
        history: [],
      },
    },
  };
  const databaseRow = (metricId, date, value, source, metadata = {}) => ({
    metric_id: metricId,
    observed_at: `${date}T00:00:00Z`,
    value,
    source,
    source_key: source,
    source_url: source === "defillama" ? "https://api-docs.defillama.com/" : "https://example.test/provider",
    quality_status: "available",
    fetched_at: "2026-07-10T23:00:00Z",
    last_checked_at: "2026-07-11T00:00:00Z",
    metadata,
  });
  const hydrated = hydrateCryptoDatasetFromRows(base, [
    databaseRow("stablecoin.usdc.marketCap", "2026-07-03", 60, "defillama"),
    databaseRow("stablecoin.usdc.marketCap", "2026-07-10", 65, "defillama"),
    databaseRow("stablecoin.usdc.marketCap", "2026-07-10", 64, "cmc"),
    databaseRow("crypto.etf.BTC.net_flow_usd", "2026-07-07", 100, "sosovalue", { cumulativeNetFlowUsd: 500 }),
    databaseRow("crypto.etf.BTC.net_flow_usd", "2026-07-09", -20, "sosovalue", { cumulativeNetFlowUsd: 480 }),
    databaseRow("treasury.mstr.btc_holdings", "2026-06-30", 100, "sosovalue", { disclosedAt: "2026-07-01", acquired: 5 }),
    databaseRow("treasury.mstr.btc_holdings", "2026-07-07", 110, "sosovalue", { disclosedAt: "2026-07-08", acquired: 10 }),
    databaseRow("treasury.bmnr.eth_holdings", "2026-06-28", 200, "SEC EDGAR", { disclosedAt: "2026-06-29" }),
    databaseRow("treasury.bmnr.eth_holdings", "2026-06-28", 220, "SEC EDGAR", { disclosedAt: "2026-07-06", acquired: 20 }),
  ], "2026-07-11T01:00:00Z");
  const usdc = hydrated.metrics.find((item) => item.id === "stablecoin.usdc.marketCap");
  assert.equal(usdc.value, 65, "a missing current level should use the widest coherent database series");
  assert.equal(usdc.source, "defillama");
  assert.equal(usdc.change7d, 5);
  assert.deepEqual(hydrated.etf.BTC.daily.map((point) => point.date), ["2026-07-07", "2026-07-09"]);
  assert.equal(hydrated.etf.BTC.weekly[0].netFlowUsd, 80);
  assert.equal(hydrated.etf.BTC.weekly[0].tradingDays, 2);
  assert.deepEqual(hydrated.corporateTreasuries.MSTR.history.map((point) => point.disclosedAt), ["2026-07-01", "2026-07-08"]);
  assert.equal(hydrated.corporateTreasuries.MSTR.holdings, 120, "database history must not overwrite the official current holdings level");
  assert.equal(hydrated.corporateTreasuries.MSTR.historySource, "sosovalue");
  assert.deepEqual(hydrated.corporateTreasuries.BMNR.history.map((point) => point.disclosedAt), ["2026-06-29", "2026-07-06"]);
  assert.equal(hydrated.databaseSync.observationsRead, 9);
  assert.equal(hydrated.historyCoverage["stablecoin.usdc.marketCap"].sources[0], "defillama");
  assert.equal(hydrated.history["stablecoin.usdc.marketCap"].at(-1).fetchedAt, "2026-07-10T23:00:00.000Z");
  assert.equal(hydrated.history["stablecoin.usdc.marketCap"].at(-1).lastCheckedAt, "2026-07-11T00:00:00.000Z");
  assert.notEqual(hydrated.history["stablecoin.usdc.marketCap"].at(-1).fetchedAt, hydrated.databaseSync.syncedAt);

  const roundTripRows = extractCryptoHistoryRows(hydrated);
  const roundTripLevel = roundTripRows.find((item) => item.metric_id === "stablecoin.usdc.marketCap" && item.observed_at.startsWith("2026-07-10"));
  const roundTripEtf = roundTripRows.find((item) => item.metric_id === "crypto.etf.BTC.net_flow_usd" && item.observed_at.startsWith("2026-07-09"));
  assert.equal(roundTripLevel.fetched_at, "2026-07-10T23:00:00.000Z");
  assert.equal(roundTripLevel.last_checked_at, "2026-07-11T00:00:00.000Z");
  assert.equal(roundTripEtf.fetched_at, "2026-07-10T23:00:00.000Z");
  assert.equal(roundTripEtf.last_checked_at, "2026-07-11T00:00:00.000Z");
});

test("database hydration never lets a stale long series replace a fresh short series", () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const rowsFor = (source, endDate, count) => {
    const end = Date.parse(`${endDate}T00:00:00Z`);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(end - ((count - index - 1) * dayMs)).toISOString().slice(0, 10);
      return {
        metric_id: "stablecoin.usdc.marketCap",
        observed_at: `${date}T00:00:00Z`,
        value: 100 + index,
        source,
        source_key: source,
        source_url: `https://example.test/${source}`,
        quality_status: "available",
        fetched_at: `${endDate}T01:00:00Z`,
        last_checked_at: `${endDate}T02:00:00Z`,
        metadata: {},
      };
    });
  };
  const hydrated = hydrateCryptoDatasetFromRows({
    metrics: [{ id: "stablecoin.usdc.marketCap", value: null, source: "cmc", unit: "USD" }],
    history: {},
  }, [
    ...rowsFor("cmc", "2026-06-30", 200),
    ...rowsFor("defillama", "2026-07-10", 30),
  ], "2026-07-11T00:00:00Z");

  assert.equal(hydrated.history["stablecoin.usdc.marketCap"].length, 30);
  assert.equal(hydrated.history["stablecoin.usdc.marketCap"].at(-1).date, "2026-07-10");
  assert.equal(hydrated.history["stablecoin.usdc.marketCap"].at(-1).source, "defillama");
  assert.equal(hydrated.metrics[0].source, "defillama");
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
  assert.match(source, /cryptoHistoryPageSize = 1000/);
  assert.match(source, /offset: String\(page \* cryptoHistoryPageSize\)/, "database hydration must page beyond PostgREST's common 1000-row cap");
  assert.match(source, /hydrateCryptoDatasetFromRows/);
});
