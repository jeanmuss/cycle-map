import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeCryptoLiquiditySnapshots,
  mergeMarketSessionSnapshots,
  selectFreshSnapshot,
  validatePassthroughSnapshot,
} from "../scripts/data-cache-merge-contract.mjs";

const point = (date, value, source = "cmc") => ({
  date,
  observedAt: `${date}T00:00:00.000Z`,
  value,
  source,
});

test("plain generated snapshots select the newer remote dataset", () => {
  const local = { generatedAt: "2026-07-10T00:00:00Z", value: "local" };
  const remote = { generatedAt: "2026-07-15T00:00:00Z", value: "remote" };
  const result = selectFreshSnapshot(local, remote);
  assert.equal(result.selected, "remote");
  assert.strictEqual(result.snapshot, remote);
});

test("passthrough validation rejects a newer but incomplete equity-fast snapshot", () => {
  const local = {
    metrics: [
      { id: "A", value: 1, asOf: "2026-07-15T00:00:00Z" },
      { id: "B", value: 2, asOf: "2026-07-15T00:00:00Z" },
    ],
  };
  const remote = {
    metrics: [{ id: "A", value: null, asOf: "2026-07-16T00:00:00Z" }],
  };
  assert.throws(
    () => validatePassthroughSnapshot("equity-fast.json", local, remote),
    /dropped existing keys/,
  );
});

test("same-day crypto history chooses the later provider revision", () => {
  const local = {
    version: 4,
    generatedAt: "2026-07-16T02:00:00Z",
    timestamps: { fetchedAt: "2026-07-16T01:00:00Z" },
    metrics: [{ id: "crypto.totalMarketCap", value: 10, observedAt: "2026-07-16T00:00:00Z", source: "cmc" }],
    history: { "crypto.totalMarketCap": [{ date: "2026-07-16", value: 10 }] },
    etf: {
      BTC: { asset: "BTC", observedAt: "2026-07-16", source: "sosovalue", daily: [{ date: "2026-07-16", netFlowUsd: 10 }] },
    },
    spotPrices: { BTC: { asset: "BTC", priceUsd: 60, observedAt: "2026-07-16T00:00:00Z", source: "cmc" } },
    corporateTreasuries: {},
  };
  const remote = {
    version: 3,
    generatedAt: "2026-07-16T03:00:00Z",
    timestamps: { fetchedAt: "2026-07-16T02:00:00Z" },
    metrics: [{ id: "crypto.totalMarketCap", value: 11, observedAt: "2026-07-16T00:00:00Z", source: "cmc" }],
    history: { "crypto.totalMarketCap": [{ date: "2026-07-16", value: 11 }] },
    etf: {
      BTC: { asset: "BTC", observedAt: "2026-07-16", source: "sosovalue", daily: [{ date: "2026-07-16", netFlowUsd: 11 }] },
    },
    spotPrices: { BTC: { asset: "BTC", priceUsd: 65, observedAt: "2026-07-16T00:00:00Z", source: "cmc" } },
    corporateTreasuries: {},
  };
  const merged = mergeCryptoLiquiditySnapshots(local, remote, { now: "2026-07-16T04:00:00Z" });
  assert.equal(merged.history["crypto.totalMarketCap"][0].value, 11);
  assert.equal(merged.history["crypto.totalMarketCap"][0].fetchedAt, "2026-07-16T02:00:00Z");
  assert.equal(merged.metrics[0].value, 11);
  assert.equal(merged.spotPrices.BTC.priceUsd, 65);
  assert.equal(merged.etf.BTC.daily[0].netFlowUsd, 11);
  assert.equal(merged.etf.BTC.daily[0].fetchedAt, "2026-07-16T02:00:00Z");
});

test("newer null crypto metrics cannot replace a valid last-known-good value", () => {
  const local = {
    version: 4,
    timestamps: { fetchedAt: "2026-07-15T02:00:00Z" },
    metrics: [{ id: "btc.marketCap", value: 10, observedAt: "2026-07-15T00:00:00Z", source: "cmc" }],
    history: {},
    etf: {},
    spotPrices: { BTC: { asset: "BTC", priceUsd: 60, observedAt: "2026-07-15T00:00:00Z", source: "cmc" } },
    corporateTreasuries: {},
  };
  const remote = {
    version: 3,
    timestamps: { fetchedAt: "2026-07-16T02:00:00Z" },
    metrics: [{ id: "btc.marketCap", value: null, observedAt: "2026-07-16T00:00:00Z", source: "cmc" }],
    history: {},
    etf: {},
    spotPrices: { BTC: { asset: "BTC", priceUsd: null, observedAt: "2026-07-16T00:00:00Z", source: "cmc" } },
    corporateTreasuries: {},
  };
  const merged = mergeCryptoLiquiditySnapshots(local, remote, { now: "2026-07-16T04:00:00Z" });
  assert.equal(merged.metrics[0].value, 10);
  assert.equal(merged.metrics[0].observedAt, "2026-07-15T00:00:00Z");
  assert.equal(merged.metrics[0].fetchedAt, "2026-07-15T02:00:00Z");
  assert.equal(merged.spotPrices.BTC.priceUsd, 60);
  assert.equal(merged.spotPrices.BTC.fetchedAt, "2026-07-15T02:00:00Z");
});

test("valid remote crypto LKG beats a newer local null snapshot", () => {
  const local = {
    version: 4,
    timestamps: { fetchedAt: "2026-07-16T02:00:00Z" },
    metrics: [{ id: "btc.marketCap", value: null, observedAt: "2026-07-16T00:00:00Z", source: "failed-refresh" }],
    history: {},
    etf: {},
    spotPrices: { BTC: { asset: "BTC", priceUsd: null, observedAt: "2026-07-16T00:00:00Z", source: "failed-refresh" } },
    corporateTreasuries: {},
  };
  const remote = {
    version: 3,
    timestamps: { fetchedAt: "2026-07-15T02:00:00Z" },
    metrics: [{ id: "btc.marketCap", value: 10, observedAt: "2026-07-15T00:00:00Z", source: "cmc" }],
    history: {},
    etf: {},
    spotPrices: { BTC: { asset: "BTC", priceUsd: 60, observedAt: "2026-07-15T00:00:00Z", source: "cmc" } },
    corporateTreasuries: {},
  };
  const merged = mergeCryptoLiquiditySnapshots(local, remote, { now: "2026-07-16T04:00:00Z" });
  assert.equal(merged.metrics[0].value, 10);
  assert.equal(merged.metrics[0].fetchedAt, "2026-07-15T02:00:00Z");
  assert.equal(merged.spotPrices.BTC.priceUsd, 60);
  assert.equal(merged.spotPrices.BTC.fetchedAt, "2026-07-15T02:00:00Z");
});

test("crypto merge preserves local long history and primary treasury while accepting newer remote observations", () => {
  const local = {
    version: 4,
    generatedAt: "2026-07-16T04:00:00Z",
    timestamps: { fetchedAt: "2026-07-16T03:00:00Z" },
    sectionObservedAt: {},
    status: "partial",
    metrics: [
      { id: "stablecoin.usdt.marketCap", labelZh: "本地标签", value: 110, observedAt: "2026-07-16T00:00:00Z", source: "defillama" },
      { id: "stablecoin.usdt.depegBps", labelZh: "脱锚", value: -7, observedAt: "2026-07-10T00:00:00Z", source: "existing-static-cache" },
    ],
    history: {
      "stablecoin.usdt.marketCap": [point("2026-07-15", 100, "defillama"), point("2026-07-16", 110, "defillama")],
      "stablecoin.usdt.depegBps": [point("2026-07-10", -7, "existing-static-cache")],
    },
    etf: {
      BTC: { asset: "BTC", daily: [{ date: "2026-07-15", netFlowUsd: 20 }], source: "database" },
    },
    spotPrices: {
      BTC: { asset: "BTC", priceUsd: 60000, observedAt: "2026-07-10T00:00:00Z", source: "cmc" },
      ETH: { asset: "ETH", priceUsd: null, observedAt: null, source: "existing-static-cache" },
    },
    corporateTreasuries: {
      MSTR: { ticker: "MSTR", asset: "BTC", holdings: 847363, averageCostUsd: 50000, source: "official" },
    },
    sources: { cmc: "https://coinmarketcap.com/api/documentation/pro-api-reference/" },
  };
  const remote = {
    version: 3,
    generatedAt: "2026-07-15T23:30:00Z",
    timestamps: { fetchedAt: "2026-07-15T23:30:00Z" },
    metrics: [
      { id: "stablecoin.usdt.marketCap", labelZh: "远端旧标签", value: 105, observedAt: "2026-07-15T23:00:00Z", source: "cmc" },
      { id: "stablecoin.usdt.depegBps", labelZh: "远端标签", value: -3, price: 0.9997, observedAt: "2026-07-15T23:00:00Z", source: "cmc" },
    ],
    history: {
      "stablecoin.usdt.marketCap": [point("2026-07-15", 999)],
      "stablecoin.usdt.depegBps": [point("2026-07-14", -4), point("2026-07-15", -3)],
    },
    etf: {
      BTC: { asset: "BTC", daily: [{ date: "2026-07-14", netFlowUsd: 10 }], source: "sosovalue" },
    },
    spotPrices: {
      BTC: { asset: "BTC", priceUsd: 65000, observedAt: "2026-07-15T23:00:00Z", source: "cmc" },
      ETH: { asset: "ETH", priceUsd: 1900, observedAt: "2026-07-15T23:00:00Z", source: "cmc" },
    },
    corporateTreasuries: {
      MSTR: { ticker: "MSTR", asset: "BTC", holdings: 843775, source: "sosovalue" },
    },
    sources: { cmc: "https://coinmarketcap.com/api/documentation/v1/" },
  };

  const merged = mergeCryptoLiquiditySnapshots(local, remote, { now: "2026-07-16T05:00:00Z" });
  const usdt = merged.metrics.find((item) => item.id === "stablecoin.usdt.marketCap");
  const depeg = merged.metrics.find((item) => item.id === "stablecoin.usdt.depegBps");
  assert.equal(merged.version, 4);
  assert.equal(usdt.value, 110);
  assert.equal(usdt.labelZh, "本地标签");
  assert.deepEqual(merged.history["stablecoin.usdt.marketCap"].map((item) => item.value), [100, 110]);
  assert.deepEqual(merged.history["stablecoin.usdt.depegBps"].map((item) => item.date), ["2026-07-10", "2026-07-14", "2026-07-15"]);
  assert.equal(merged.history["stablecoin.usdt.depegBps"][0].sourceUrl, null);
  assert.equal(merged.history["stablecoin.usdt.depegBps"].at(-1).source, "cmc");
  assert.equal(merged.history["stablecoin.usdt.depegBps"].at(-1).fetchedAt, "2026-07-15T23:30:00Z");
  assert.equal(depeg.value, -3);
  assert.equal(depeg.labelZh, "脱锚");
  assert.deepEqual(merged.etf.BTC.daily.map((item) => item.date), ["2026-07-14", "2026-07-15"]);
  assert.equal(merged.spotPrices.BTC.priceUsd, 65000);
  assert.equal(merged.spotPrices.ETH.priceUsd, 1900);
  assert.equal(merged.corporateTreasuries.MSTR.holdings, 847363);
  assert.equal(merged.corporateTreasuries.MSTR.costGapPct, 30);
  assert.equal(merged.sectionObservedAt.levels, "2026-07-16T00:00:00.000Z");
  assert.equal(merged.timestamps.observedAt, "2026-07-16T00:00:00.000Z");
  assert.equal(merged.timestamps.transformedAt, "2026-07-16T05:00:00.000Z");
});

test("market-session merge takes newer quotes but preserves local calendars and index eligibility", () => {
  const localMarkets = [{ id: "cn", sessionTemplates: [{ key: "fixed-price", start: "15:05", end: "15:30" }] }];
  const local = {
    version: 2,
    generatedAt: "2026-07-16T03:00:00Z",
    timestamps: { fetchedAt: "2026-07-11T00:00:00Z" },
    markets: localMarkets,
    failures: [],
    assets: [
      { symbol: "BTC", price: 60, asOf: "2026-07-11T00:00:00Z", sourceLabel: "old" },
      { symbol: "NVDA", price: 100, asOf: "2026-07-11T00:00:00Z", sourceLabel: "valid LKG" },
      { symbol: "MSFT", price: 100, asOf: "2026-07-15T23:00:00Z", sourceLabel: "earlier revision" },
      { symbol: "CL", price: null, asOf: "2026-07-16T00:00:00Z", sourceLabel: "newer failed refresh" },
      { symbol: "SSE50", price: null, asOf: null, sessionEligibility: "non_tradable_index_proxy", sourceLabel: "index proxy" },
    ],
    sources: { sseTradingRules: "official-new-rule" },
  };
  const remote = {
    version: 2,
    generatedAt: "2026-07-15T23:00:00Z",
    timestamps: { fetchedAt: "2026-07-15T23:00:00Z" },
    markets: [{ id: "cn", sessionTemplates: [] }],
    failures: [],
    assets: [
      { symbol: "BTC", price: 65, asOf: "2026-07-15T23:00:00Z", sourceLabel: "new" },
      { symbol: "NVDA", price: null, asOf: "2026-07-15T23:00:00Z", sourceLabel: "failed refresh" },
      { symbol: "MSFT", price: 101, asOf: "2026-07-15T23:00:00Z", sourceLabel: "later revision" },
      { symbol: "CL", price: 80, asOf: "2026-07-15T00:00:00Z", sourceLabel: "valid remote LKG" },
      { symbol: "SSE50", price: null, asOf: null, sourceLabel: "remote pending" },
    ],
    sources: { cmc: "official" },
  };
  const merged = mergeMarketSessionSnapshots(local, remote, { now: "2026-07-16T05:00:00Z" });
  assert.strictEqual(merged.markets, localMarkets);
  assert.equal(merged.assets.find((item) => item.symbol === "BTC").price, 65);
  assert.equal(merged.assets.find((item) => item.symbol === "BTC").sourceLabel, "new");
  assert.equal(merged.assets.find((item) => item.symbol === "NVDA").price, 100);
  assert.equal(merged.assets.find((item) => item.symbol === "NVDA").sourceLabel, "valid LKG");
  assert.equal(merged.assets.find((item) => item.symbol === "MSFT").price, 101);
  assert.equal(merged.assets.find((item) => item.symbol === "MSFT").sourceLabel, "later revision");
  assert.equal(merged.assets.find((item) => item.symbol === "MSFT").fetchedAt, "2026-07-15T23:00:00Z");
  assert.equal(merged.assets.find((item) => item.symbol === "CL").price, 80);
  assert.equal(merged.assets.find((item) => item.symbol === "CL").sourceLabel, "valid remote LKG");
  assert.equal(merged.assets.find((item) => item.symbol === "CL").fetchedAt, "2026-07-15T23:00:00Z");
  const index = merged.assets.find((item) => item.symbol === "SSE50");
  assert.equal(index.sessionEligibility, "non_tradable_index_proxy");
  assert.equal(index.sourceLabel, "index proxy");
  assert.equal(merged.timestamps.observedAt, "2026-07-15T23:00:00.000Z");
  assert.equal(merged.timestamps.fetchedAt, "2026-07-15T23:00:00.000Z");
  assert.equal(merged.timestamps.transformedAt, "2026-07-16T05:00:00.000Z");
  assert.equal(merged.sources.sseTradingRules, "official-new-rule");
  assert.equal(merged.sources.cmc, "official");
});

test("merge transformation time is the actual merge time even when an input timestamp is in the future", () => {
  const local = { version: 2, generatedAt: "2027-01-01T00:00:00Z", markets: [], assets: [], timestamps: {} };
  const remote = { version: 2, generatedAt: "2027-01-02T00:00:00Z", markets: [], assets: [], timestamps: {} };
  const merged = mergeMarketSessionSnapshots(local, remote, { now: "2026-07-16T05:00:00Z" });
  assert.equal(merged.generatedAt, "2026-07-16T05:00:00.000Z");
  assert.equal(merged.timestamps.transformedAt, "2026-07-16T05:00:00.000Z");
});
