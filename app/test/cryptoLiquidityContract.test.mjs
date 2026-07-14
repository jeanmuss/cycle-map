import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  aggregateWeeklyFlows,
  attachMetricChanges,
  attachTreasurySpotPrice,
  mergeMetricHistory,
  mergeSosoEtfHistory,
  mergeTreasurySnapshots,
  normalizeBlockbeatsBtcHistory,
  normalizeCmcLiquidity,
  normalizeReviewedTreasuryDisclosure,
  normalizeSosoEtfHistory,
  normalizeStrategyTreasuryHistory,
  requireCmcLiquiditySnapshot,
  requireSosoEtfHistory,
} from "../scripts/crypto-liquidity-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const updaterPath = resolve(appRoot, "scripts", "update-crypto-liquidity-data.mjs");
const outputPath = resolve(appRoot, "public", "data", "crypto-liquidity.json");

function runUpdaterWithoutCredentials() {
  const env = { ...process.env, BLOCKBEATS_AUX_ENABLED: "0", CYCLE_MAP_SKIP_LOCAL_ENV: "1" };
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
      1: { id: 1, quote: { USD: { market_cap: 1_000, last_updated: "2026-07-10T00:00:00Z" } } },
      825: { id: 825, quote: { USD: { market_cap: 180, price: 0.9995, last_updated: "2026-07-10T00:00:00Z" } } },
      3408: { id: 3408, quote: { USD: { market_cap: 60, price: 1, last_updated: "2026-07-10T00:00:00Z" } } },
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
  const [result] = attachMetricChanges([metric], history);
  assert.equal(result.change1d, 20);
  assert.equal(result.change7d, 30);
  assert.equal(aggregateWeeklyFlows([{ date: "2026-07-10", netFlowUsd: 1 }])[0].week, "2026-07-06");
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
