import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { statusAtTimeline } from "./market-session-calendar.mjs";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataRoot = resolve(appRoot, "public", "data");

function argumentValue(name, fallback = null) {
  const direct = process.argv.find((item) => item.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function load(name) {
  return JSON.parse(readFileSync(resolve(dataRoot, name), "utf8"));
}

function dateKey(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function assertUniqueSorted(rows, key, label) {
  const values = rows.map(key);
  assert.equal(new Set(values).size, values.length, `${label} contains duplicate keys`);
  assert.deepEqual(values, [...values].sort(), `${label} is not sorted`);
}

const crypto = load("crypto-liquidity.json");
assert.equal(crypto.version, 4, "crypto-liquidity must retain the local v4 contract");
for (const id of [
  "stablecoin.usdt.marketCap",
  "stablecoin.usdc.marketCap",
  "stablecoin.major.marketCap",
]) {
  const rows = crypto.history?.[id] || [];
  assert.ok(rows.length >= 183, `${id} lost the six-month history floor`);
  assertUniqueSorted(rows, (item) => item.date, id);
}
for (const asset of ["BTC", "ETH", "SOL"]) {
  const rows = crypto.etf?.[asset]?.daily || [];
  assert.ok(rows.length >= 20, `${asset} ETF history regressed`);
  assertUniqueSorted(rows, (item) => item.date, `${asset} ETF history`);
}
const depeg = crypto.history?.["stablecoin.usdt.depegBps"] || [];
assert.ok(depeg.length >= 4, "USDT depeg history did not absorb the remote observations");
assertUniqueSorted(depeg, (item) => item.date, "USDT depeg history");
assert.ok(depeg.at(-1)?.date >= "2026-07-15", "USDT depeg history is still stale");
const expectedMstrValue = argumentValue("--expected-mstr");
const expectedMstr = expectedMstrValue == null || expectedMstrValue === ""
  ? null
  : Number(expectedMstrValue);
if (Number.isFinite(expectedMstr)) {
  assert.equal(crypto.corporateTreasuries?.MSTR?.holdings, expectedMstr, "MSTR primary disclosure was overwritten");
}
for (const asset of ["BTC", "ETH"]) {
  assert.ok(Number.isFinite(crypto.spotPrices?.[asset]?.priceUsd), `${asset} spot price is unavailable after merge`);
}
const latestMetricDate = [...(crypto.metrics || [])]
  .map((item) => item.observedAt)
  .filter(Boolean)
  .sort()
  .at(-1);
assert.equal(dateKey(crypto.sectionObservedAt?.levels), dateKey(latestMetricDate), "level section timestamp does not match retained metrics");
assert.equal(dateKey(crypto.timestamps?.observedAt), dateKey(latestMetricDate), "top-level observation timestamp does not match retained metrics");

const marketSession = load("market-session.json");
assert.equal(new Set((marketSession.assets || []).map((item) => item.symbol)).size, 13, "market-session asset symbols are not unique");
const cn = (marketSession.markets || []).find((item) => item.id === "cn");
assert.ok(cn, "China market calendar is missing");
assert.equal(statusAtTimeline(cn.statusTimeline, "2026-07-10T07:02:00Z").key, "fixed-price-gap");
assert.equal(statusAtTimeline(cn.statusTimeline, "2026-07-10T07:02:00Z").active, false);
assert.equal(statusAtTimeline(cn.statusTimeline, "2026-07-10T07:05:00Z").key, "fixed-price");
assert.equal(statusAtTimeline(cn.statusTimeline, "2026-07-10T07:05:00Z").active, true);
for (const symbol of ["CSI500", "SSE50"]) {
  assert.equal(
    marketSession.assets.find((item) => item.symbol === symbol)?.sessionEligibility,
    "non_tradable_index_proxy",
    `${symbol} lost its non-tradable proxy marker`,
  );
}
const minQuoteDate = argumentValue("--min-quote-date", "2026-07-15");
const quotedAssets = (marketSession.assets || []).filter((item) => Number.isFinite(item.price));
assert.ok(quotedAssets.length >= 8, "market-session lost remote quoted assets");
for (const item of quotedAssets) {
  assert.ok(dateKey(item.asOf) >= minQuoteDate, `${item.symbol} quote is older than ${minQuoteDate}`);
}

const chart = load("chart-series.json");
const metricKeys = Object.keys(chart.metrics || {}).sort();
const seriesKeys = Object.keys(chart.series || {}).sort();
const orderKeys = [...(chart.metricOrder || [])].sort();
assert.ok(metricKeys.length >= 99, "chart-series did not absorb the remote metrics");
assert.deepEqual(seriesKeys, metricKeys, "chart-series metric and series keys differ");
assert.deepEqual(orderKeys, metricKeys, "chart-series metric order keys differ");
for (const [id, rows] of Object.entries(chart.series || {})) {
  assertUniqueSorted(rows, (item) => item.t, `chart series ${id}`);
}

const equityWeekly = load("equity-weekly.json");
assert.ok((equityWeekly.days || []).length >= 227, "equity-weekly did not absorb the remote history");
assertUniqueSorted(equityWeekly.days || [], (item) => item.date, "equity-weekly days");
assert.deepEqual(equityWeekly.failures, [], "equity-weekly retained stale failures");

const equityFast = load("equity-fast.json");
assert.ok((equityFast.metrics || []).length >= 3, "equity-fast did not absorb the remote metrics");
assert.equal(new Set((equityFast.metrics || []).map((item) => item.id)).size, equityFast.metrics.length, "equity-fast contains duplicate metrics");
for (const metric of equityFast.metrics || []) {
  assert.ok(Number.isFinite(metric.value), `equity-fast ${metric.id} has no value`);
  assert.ok(dateKey(metric.asOf) >= "2026-07-14", `equity-fast ${metric.id} is stale`);
}

const marketMonthly = load("market-monthly.json");
assert.ok(Object.keys(marketMonthly.assets || {}).length >= 5, "market-monthly lost assets");
for (const [symbol, asset] of Object.entries(marketMonthly.assets || {})) {
  assertUniqueSorted(asset.rows || [], (item) => item.monthKey, `market-monthly ${symbol}`);
  assert.ok((asset.rows || []).length >= 21, `market-monthly ${symbol} lost history`);
  assert.ok(dateKey(asset.updatedAt) >= "2026-07-15", `market-monthly ${symbol} is stale`);
}

const macro = load("macro-calendar.json");
const macroKey = (item) => [
  item.date,
  item.seriesId,
  item.role,
  item.country,
  item.holiday,
  item.source,
  item.label,
].join("|");
assert.ok((macro.events || []).length >= 130, "macro calendar did not absorb the remote events");
assert.equal(new Set((macro.events || []).map(macroKey)).size, macro.events.length, "macro calendar contains duplicate events");

for (const [file, minimumAssets] of [
  ["chip-chain-hotspots.json", 30],
  ["robot-chain-watchlist.json", 21],
]) {
  const dataset = load(file);
  const assets = Object.values(dataset.assets || {});
  assert.ok(assets.length >= minimumAssets, `${file} lost assets`);
  assert.equal(new Set(assets.map((item) => item.symbol)).size, assets.length, `${file} contains duplicate symbols`);
  for (const item of assets) {
    const paths = Array.isArray(item.pricePaths)
      ? [["default", item.pricePaths]]
      : Object.entries(item.pricePaths || {});
    for (const [range, rows] of paths) {
      if (Array.isArray(rows) && rows.length) {
        assertUniqueSorted(rows, (point) => point.t, `${file} ${item.symbol} ${range} price path`);
      }
    }
  }
}

console.log(JSON.stringify({
  status: "verified",
  crypto: {
    stablecoinDays: crypto.history["stablecoin.usdt.marketCap"].length,
    etfDays: Object.fromEntries(["BTC", "ETH", "SOL"].map((asset) => [asset, crypto.etf[asset].daily.length])),
    depegDays: depeg.length,
    mstrHoldings: crypto.corporateTreasuries.MSTR.holdings,
  },
  marketSession: { assets: marketSession.assets.length, quotedAssets: quotedAssets.length },
  chartMetrics: metricKeys.length,
  equityFastMetrics: equityFast.metrics.length,
  equityDays: equityWeekly.days.length,
  macroEvents: macro.events.length,
  monthlyAssets: Object.keys(marketMonthly.assets).length,
}, null, 2));
