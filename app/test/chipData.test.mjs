import test from "node:test";
import assert from "node:assert/strict";
import {
  chipCategoryRows,
  chipPendingAssets,
  chipTopMovers,
  isChipSampleAsset,
} from "../src/chipData.js";

const dataset = {
  categories: [
    { id: "memory", tickers: ["LIVE_A", "LIVE_B", "SAMPLE_KR"] },
  ],
  assets: {
    LIVE_A: { symbol: "LIVE_A", sourceKind: "live_cache", returns: { "1d": 4 } },
    LIVE_B: { symbol: "LIVE_B", sourceKind: "live_cache", returns: { "1d": -2 } },
    SAMPLE_KR: {
      symbol: "SAMPLE_KR",
      sourceKind: "sample",
      dataQuality: "Korea adapter pending; retaining sample/static row.",
      returns: { "1d": 40 },
    },
  },
};

test("sample and pending assets are identified conservatively", () => {
  assert.equal(isChipSampleAsset(dataset.assets.SAMPLE_KR), true);
  assert.equal(isChipSampleAsset({ sourceKind: "live_cache", dataQuality: "provider pending" }), true);
  assert.equal(isChipSampleAsset(dataset.assets.LIVE_A), false);
});

test("sample rows do not affect category averages or leaders", () => {
  const rows = chipCategoryRows(dataset, "1d");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].assets.map((asset) => asset.symbol), ["LIVE_A", "LIVE_B"]);
  assert.equal(rows[0].average, 1);
  assert.equal(rows[0].leader.symbol, "LIVE_A");
});

test("hotspot rankings and pending watchlist remain separate", () => {
  const rows = chipCategoryRows(dataset, "1d");
  assert.deepEqual(chipTopMovers(rows, "1d").map((asset) => asset.symbol), ["LIVE_A", "LIVE_B"]);
  assert.deepEqual(chipPendingAssets(dataset).map((asset) => asset.symbol), ["SAMPLE_KR"]);
});
