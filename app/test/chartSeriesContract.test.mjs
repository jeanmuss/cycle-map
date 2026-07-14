import assert from "node:assert/strict";
import test from "node:test";

import { mergeLastKnownGoodPoints } from "../scripts/chart-series-contract.mjs";

test("stale provider caches cannot delete or revise newer last-known-good macro points", () => {
  const merged = mergeLastKnownGoodPoints({
    current: [{ t: "2026-07-08", v: 2.175 }, { t: "2026-07-10", v: 5 }],
    baseline: [{ t: "2026-07-08", v: 3.347 }, { t: "2026-07-09", v: 5.772 }],
    currentFetchedAt: "2026-07-02T00:00:00Z",
    baselineFetchedAt: "2026-07-11T00:00:00Z",
  });
  assert.deepEqual(merged, [
    { t: "2026-07-08", v: 3.347 },
    { t: "2026-07-09", v: 5.772 },
    { t: "2026-07-10", v: 5 },
  ]);
});

test("a confirmed newer provider fetch may revise the same observation", () => {
  const merged = mergeLastKnownGoodPoints({
    current: [{ t: "2026-07-08", v: 3.5 }],
    baseline: [{ t: "2026-07-08", v: 3.347 }],
    currentFetchedAt: "2026-07-12T00:00:00Z",
    baselineFetchedAt: "2026-07-11T00:00:00Z",
  });
  assert.deepEqual(merged, [{ t: "2026-07-08", v: 3.5 }]);
});
