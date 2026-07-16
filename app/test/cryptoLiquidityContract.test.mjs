import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  aggregateWeeklyFlows,
  attachHistoricalMetricFallbacks,
  attachMetricChanges,
  attachTreasurySpotPrice,
  combineDefiLlamaStablecoinHistory,
  hasFreshCmcStablecoinBackfill,
  mergeMetricHistory,
  mergeSosoEtfHistory,
  mergeTreasurySnapshots,
  normalizeBlockbeatsBtcHistory,
  normalizeCmcHistoricalLiquidity,
  normalizeCmcLiquidity,
  normalizeDefiLlamaStablecoinHistory,
  normalizeReviewedTreasuryDisclosure,
  normalizeSosoEtfHistory,
  normalizeStrategyTreasuryHistory,
  planCmcHistoryFetch,
  requireCmcLiquiditySnapshot,
  requireSosoEtfHistory,
} from "../scripts/crypto-liquidity-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const updaterPath = resolve(appRoot, "scripts", "update-crypto-liquidity-data.mjs");
const outputPath = resolve(appRoot, "public", "data", "crypto-liquidity.json");

function runUpdaterWithoutCredentials() {
  const env = {
    ...process.env,
    BLOCKBEATS_AUX_ENABLED: "0",
    CYCLE_MAP_DISABLE_PUBLIC_HISTORY: "1",
    CYCLE_MAP_SKIP_LOCAL_ENV: "1",
  };
  delete env.CMC_PRO_API_KEY;
  delete env.SOSOVALUE_API_KEY;
  delete env.BLOCKBEATS_API_KEY;
  delete env.SEC_USER_AGENT;

  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [updaterPath], {
      cwd: appRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

test("CMC metrics keep valuation and flow semantics separate", () => {
  const metrics = normalizeCmcLiquidity({
    status: { timestamp: "2026-07-10T00:00:00Z" },
    data: { quote: { USD: { total_market_cap: 2_000, last_updated: "2026-07-10T00:00:00Z" } } },
  }, {
    data: {
      1: { id: 1, quote: [{ symbol: "USD", market_cap: 1_000, last_updated: "2026-07-10T00:00:00Z" }] },
      825: { id: 825, quote: [{ symbol: "USD", market_cap: 180, price: 0.9995, last_updated: "2026-07-10T00:00:00Z" }] },
      3408: { id: 3408, quote: [{ symbol: "USD", market_cap: 60, price: 1, last_updated: "2026-07-10T00:00:00Z" }] },
    },
  });
  const byId = Object.fromEntries(metrics.map((item) => [item.id, item]));
  assert.equal(byId["crypto.totalMarketCap"].semantics, "market_cap_change_not_net_flow");
  assert.equal(byId["stablecoin.major.marketCap"].value, 240);
  assert.ok(Math.abs(byId["stablecoin.usdt.depegBps"].value + 5) < 1e-9);
});

test("CMC snapshots reject successful but incomplete responses", () => {
  assert.throws(() => requireCmcLiquiditySnapshot([
    { id: "crypto.totalMarketCap", value: 2_000, observedAt: "2026-07-10" },
  ], {}), /omitted required fields/);
});

test("CMC historical responses normalize daily aggregate, asset, peg, and derived stablecoin series", () => {
  const global = {
    status: { timestamp: "2026-07-16T01:00:00Z" },
    data: { quotes: [
      { timestamp: "2026-07-14T00:02:00Z", quote: { USD: { total_market_cap: 2_000 } } },
      { timestamp: "2026-07-15T00:02:00Z", quote: { USD: { total_market_cap: 2_100 } } },
    ] },
  };
  const quote = (timestamp, marketCap, price = 1) => ({ timestamp, quote: { USD: { market_cap: marketCap, price } } });
  const assets = {
    status: { timestamp: "2026-07-16T01:00:00Z" },
    data: {
      1: { id: 1, quotes: [quote("2026-07-14T00:04:00Z", 1_000), quote("2026-07-15T00:04:00Z", 1_100)] },
      825: { id: 825, quotes: [quote("2026-07-14T00:04:00Z", 180, 0.999), quote("2026-07-15T00:04:00Z", 182, 1.001)] },
      3408: { id: 3408, quotes: [quote("2026-07-14T00:04:00Z", 60), quote("2026-07-15T00:04:00Z", 61)] },
    },
  };
  const history = normalizeCmcHistoricalLiquidity(global, assets);
  assert.deepEqual(history["crypto.totalMarketCap"].map((point) => point.value), [2_000, 2_100]);
  assert.deepEqual(history["stablecoin.major.marketCap"].map((point) => point.value), [240, 243]);
  assert.ok(Math.abs(history["stablecoin.usdt.depegBps"][0].value + 10) < 1e-9);
  assert.equal(history["stablecoin.major.marketCap"][0].qualityStatus, "derived_same_date_sum");
});

test("history planning backfills at least six months once, then requests a short overlap", () => {
  const now = new Date("2026-07-16T12:00:00Z");
  const initial = planCmcHistoryFetch([], now);
  assert.equal(initial.mode, "initial_backfill");
  assert.ok(initial.minimumBackfillDays >= 183);
  assert.equal((Date.parse(initial.timeEnd) - Date.parse(initial.timeStart)) / 86_400_000, 364);

  const complete = Array.from({ length: 365 }, (_, index) => ({
    date: new Date(Date.UTC(2025, 6, 16 + index)).toISOString().slice(0, 10),
    value: index,
  }));
  const overlap = planCmcHistoryFetch(complete, now);
  assert.equal(overlap.mode, "overlap");
  assert.equal((Date.parse(overlap.timeEnd) - Date.parse(overlap.timeStart)) / 86_400_000, 14);
});

test("CMC stablecoin history must be both wide and fresh before disabling the fallback", () => {
  const seriesEnding = (endDate) => Array.from({ length: 183 }, (_, index) => ({
    date: new Date(Date.parse(`${endDate}T00:00:00Z`) - ((182 - index) * 86_400_000)).toISOString().slice(0, 10),
    value: index,
    source: "cmc",
  }));
  const now = new Date("2026-07-16T12:00:00Z");
  assert.equal(hasFreshCmcStablecoinBackfill({
    "stablecoin.usdt.marketCap": seriesEnding("2026-07-15"),
    "stablecoin.usdc.marketCap": seriesEnding("2026-07-14"),
  }, now), true);
  assert.equal(hasFreshCmcStablecoinBackfill({
    "stablecoin.usdt.marketCap": seriesEnding("2026-07-12"),
    "stablecoin.usdc.marketCap": seriesEnding("2026-07-12"),
  }, now), false);
});

test("DefiLlama stablecoin history keeps provider provenance and derives only same-date totals", () => {
  const payload = (id, symbol, values) => ({
    id,
    symbol,
    pegType: "peggedUSD",
    tokens: values.map(([date, value]) => ({ date: Date.parse(`${date}T00:00:00Z`) / 1000, circulating: { peggedUSD: value } })),
  });
  const usdt = normalizeDefiLlamaStablecoinHistory(payload("1", "USDT", [["2026-07-14", 180], ["2026-07-15", 181]]), "USDT", "2026-07-16T00:00:00Z");
  const usdc = normalizeDefiLlamaStablecoinHistory(payload("2", "USDC", [["2026-07-14", 60]]), "USDC", "2026-07-16T00:00:00Z");
  const history = combineDefiLlamaStablecoinHistory([usdt, usdc]);
  assert.equal(history["stablecoin.usdt.marketCap"][0].source, "defillama");
  assert.deepEqual(history["stablecoin.major.marketCap"].map((point) => point.date), ["2026-07-14"]);
  assert.equal(history["stablecoin.major.marketCap"][0].value, 240);
});

test("SoSoValue daily ETF rows are normalized without filling missing days", () => {
  const result = normalizeSosoEtfHistory({ code: 0, data: [
    { date: "2026-07-07", total_net_inflow: "100", total_net_assets: "1000", cum_net_inflow: "500" },
    { date: "2026-07-09", total_net_inflow: "-20", total_net_assets: "980", cum_net_inflow: "480" },
  ] }, "BTC");
  assert.deepEqual(result.daily.map((point) => point.date), ["2026-07-07", "2026-07-09"]);
  assert.equal(result.weekly[0].netFlowUsd, 80);
  assert.equal(result.weekly[0].tradingDays, 2);
  assert.equal(result.weekly[0].cumulativeNetFlowUsd, 480);
});

test("SoSoValue one-month windows merge into the retained ETF history", () => {
  const merged = mergeSosoEtfHistory({ asset: "SOL", daily: [
    { date: "2026-06-30", netFlowUsd: 10 },
  ] }, normalizeSosoEtfHistory([{ date: "2026-07-01", total_net_inflow: 20 }], "SOL"));
  assert.deepEqual(merged.daily.map((point) => point.date), ["2026-06-30", "2026-07-01"]);
  assert.equal(merged.status, "available");
});

test("empty SoSoValue histories are rejected instead of advancing freshness", () => {
  const result = normalizeSosoEtfHistory({ data: { list: [] } }, "BTC");
  assert.equal(result.status, "unavailable");
  assert.throws(() => requireSosoEtfHistory(result, "BTC"), /empty history/);
});

test("BlockBeats values stay auxiliary and convert millions to USD", () => {
  const result = normalizeBlockbeatsBtcHistory({ data: [
    { date: "2026-07-10", net_inflow_million: "12.5", total_inflow_million: "100" },
  ] });
  assert.equal(result.role, "auxiliary_cross_check_only");
  assert.equal(result.daily[0].netFlowUsd, 12_500_000);
});

test("metric history replaces same-day observations and derives daily and weekly changes", () => {
  const metric = { id: "btc.marketCap", value: 120, observedAt: "2026-07-10T12:00:00Z" };
  const history = mergeMetricHistory({ "btc.marketCap": [
    { date: "2026-07-03", value: 90 },
    { date: "2026-07-09", value: 100 },
    { date: "2026-07-10", value: 110 },
  ] }, [metric]);
  assert.equal(history["btc.marketCap"].length, 3);
  assert.equal(history["btc.marketCap"].at(-1).fetchedAt, null);
  const [result] = attachMetricChanges([metric], history);
  assert.equal(result.change1d, 20);
  assert.equal(result.change7d, 30);
  assert.equal(aggregateWeeklyFlows([{ date: "2026-07-10", netFlowUsd: 1 }])[0].week, "2026-07-06");
});

test("metric changes require exact calendar comparison points and stay within one source", () => {
  const metric = { id: "stablecoin.usdt.marketCap", value: 185, observedAt: "2026-07-10T12:00:00Z", source: "cmc" };
  const [result] = attachMetricChanges([metric], {
    "stablecoin.usdt.marketCap": [
      { date: "2026-07-03", value: 175, source: "defillama" },
      { date: "2026-07-09", value: 179, source: "defillama" },
      { date: "2026-07-10", value: 180, source: "defillama" },
    ],
  });
  assert.equal(result.change1d, 1);
  assert.equal(result.change7d, 5);
  assert.equal(result.change7dSource, "defillama");

  const [gapped] = attachMetricChanges([metric], {
    "stablecoin.usdt.marketCap": [
      { date: "2026-07-02", value: 175, source: "defillama" },
      { date: "2026-07-10", value: 180, source: "defillama" },
    ],
  });
  assert.equal(gapped.change1d, null);
  assert.equal(gapped.change7d, null);
});

test("missing current stablecoin levels use the latest historical point without overwriting valid CMC values", () => {
  const metrics = attachHistoricalMetricFallbacks([
    { id: "stablecoin.usdt.marketCap", value: 180, observedAt: "2026-07-16", source: "cmc" },
    { id: "stablecoin.usdc.marketCap", value: null, observedAt: null, source: "pending-cmc-refresh" },
  ], {
    "stablecoin.usdt.marketCap": [{ date: "2026-07-16", value: 185, source: "defillama" }],
    "stablecoin.usdc.marketCap": [{ date: "2026-07-16", value: 65, source: "defillama", qualityStatus: "provider_reported_circulating_usd" }],
  });
  assert.equal(metrics[0].value, 180);
  assert.equal(metrics[0].source, "cmc");
  assert.equal(metrics[1].value, 65);
  assert.equal(metrics[1].source, "defillama");
  assert.equal(metrics[1].levelFallback, true);
  const refreshed = attachHistoricalMetricFallbacks([metrics[1]], {
    "stablecoin.usdc.marketCap": [{
      date: "2026-07-17", value: 66, source: "defillama", fetchedAt: "2026-07-17T01:00:00Z",
    }],
  });
  assert.equal(refreshed[0].value, 66, "an existing fallback must advance with the provider history");
  assert.equal(refreshed[0].fetchedAt, "2026-07-17T01:00:00Z");
});

test("fresher trusted same-series history replaces stale current valuation snapshots", () => {
  const history = {
    "stablecoin.usdt.marketCap": [{ date: "2026-07-16", value: 185, source: "defillama", fetchedAt: "2026-07-16T01:00:00Z" }],
    "crypto.totalMarketCap": [{ date: "2026-07-16", value: 2_100, source: "cmc", fetchedAt: "2026-07-16T01:00:00Z" }],
  };
  const result = attachHistoricalMetricFallbacks([
    { id: "stablecoin.usdt.marketCap", value: 180, observedAt: "2026-07-10", source: "cmc" },
    { id: "crypto.totalMarketCap", value: 2_000, observedAt: "2026-07-10", source: "existing-static-cache" },
  ], history);
  assert.equal(result[0].value, 185);
  assert.equal(result[0].observedAt, "2026-07-16T00:00:00Z");
  assert.equal(result[0].source, "defillama");
  assert.equal(result[0].levelFallbackReason, "primary_current_snapshot_stale");
  assert.equal(result[1].value, 2_100);
  assert.equal(result[1].observedAt, "2026-07-16T00:00:00Z");
  assert.equal(result[1].source, "cmc");
  assert.equal(result[1].levelFallbackReason, "primary_current_snapshot_stale");
});

test("corporate treasury holdings and cost observations keep independent dates", () => {
  const strategyApi = normalizeStrategyTreasuryHistory([{ date: "2026-07-01", ticker: "MSTR", btc_holding: 850000, btc_acq: 1000, acq_cost: 70000000, avg_btc_cost: 70000 }]);
  assert.equal(strategyApi.averageCostUsd, null, "undocumented provider average must not be labelled aggregate cost");
  assert.equal(strategyApi.history[0].transactionPriceUsd, 70000);

  const reviewed = normalizeReviewedTreasuryDisclosure({
    company: "Strategy", ticker: "MSTR", asset: "BTC",
    holdings: [{ disclosedAt: "2026-06-22", holdingsObservedAt: "2026-06-21", holdings: 847363, sourceUrl: "https://example.test/8-k" }],
    costs: [{ costObservedAt: "2026-06-21", holdingsAtCostDate: 847363, averageCostUsd: 75651, sourceUrl: "https://example.test/8-k" }],
  });
  const merged = attachTreasurySpotPrice(mergeTreasurySnapshots(strategyApi, reviewed), { priceUsd: 90000, observedAt: "2026-07-01" });
  assert.equal(merged.holdings, 850000);
  assert.equal(merged.averageCostUsd, 75651);
  assert.equal(merged.costObservedAt, "2026-06-21");
  assert.ok(merged.costGapPct > 18 && merged.costGapPct < 19);

  const repeatedMerge = mergeTreasurySnapshots(merged, reviewed);
  assert.equal(repeatedMerge.costHistory.length, 1, "repeated refreshes must not duplicate the same cost observation");
});

test("updater preserves the last-known-good snapshot when every upstream is unavailable", async () => {
  const before = await readFile(outputPath, "utf8");
  const result = await runUpdaterWithoutCredentials();
  const after = await readFile(outputPath, "utf8");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /preserving last-known-good JSON/);
  assert.equal(after, before);
});

test("crypto updater uses the current SoSoValue OpenAPI host and ignored local env files", async () => {
  const source = await readFile(updaterPath, "utf8");
  assert.match(source, /https:\/\/openapi\.sosovalue\.com\/openapi\/v1/);
  assert.match(source, /etfs\/summary-history/);
  assert.match(source, /btc-treasuries\/MSTR\/purchase-history/);
  assert.match(source, /data\.sec\.gov\/submissions\/CIK/);
  assert.match(source, /process\.env\.SEC_USER_AGENT/);
  assert.match(source, /process\.env\.SEC_USER_AGENT\]\)/, "SEC contact identifier must be included in error redaction");
  assert.match(source, /resolve\(appRoot, "\.env\.local"\)/);
  assert.match(source, /resolve\(workspaceRoot, "\.env\.local"\)/);
});
