import assert from "node:assert/strict";
import test from "node:test";

import { assetSessionStatus } from "../src/marketClockStatus.js";

const indexProxy = { symbol: "SSE50", sessionEligibility: "non_tradable_index_proxy" };
const labels = { nonTradableIndexProxy: "指数代理 · 不可直接交易" };

test("non-tradable index proxies do not inherit fixed-price market phases", () => {
  for (const key of ["fixed-price-gap", "fixed-price"]) {
    const marketStatus = { key, label: "market phase", active: key === "fixed-price", sortRank: 2 };
    assert.deepEqual(assetSessionStatus(indexProxy, marketStatus, labels), {
      key: "non-tradable-index-proxy",
      label: labels.nonTradableIndexProxy,
      active: false,
      sortRank: 2,
    });
  }
});

test("index proxies still show the broader market status outside fixed-price phases", () => {
  const marketStatus = { key: "open", label: "盘中", active: true, sortRank: 1 };
  assert.strictEqual(assetSessionStatus(indexProxy, marketStatus, labels), marketStatus);
});

test("eligible A-shares and ETFs retain the market fixed-price status", () => {
  const marketStatus = { key: "fixed-price", label: "A股/ETF 盘后定价", active: true, sortRank: 2 };
  assert.strictEqual(assetSessionStatus({ symbol: "600000" }, marketStatus, labels), marketStatus);
});
