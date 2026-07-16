import assert from "node:assert/strict";
import test from "node:test";

import {
  cadenceDateAxis,
  calendarSpacedPoints,
  consecutivePeriodChanges,
  flowChartScale,
  metricHistoryByCadence,
  recentEtfFlowPoints,
  recentTreasuryDemandPoints,
} from "../src/cryptoLiquidityCharts.js";

test("ETF chart points preserve missing values instead of converting them to zero", () => {
  const points = recentEtfFlowPoints({
    daily: [
      { date: "2026-07-01", netFlowUsd: 12 },
      { date: "2026-07-02", netFlowUsd: null },
      { date: "2026-07-03", netFlowUsd: -4 },
    ],
  }, "daily");

  assert.deepEqual(points, [
    { date: "2026-07-01", value: 12 },
    { date: "2026-07-02", value: null },
    { date: "2026-07-03", value: -4 },
  ]);
  assert.deepEqual(flowChartScale(points), { finiteCount: 2, maxAbsoluteValue: 12 });
});

test("ETF chart uses the selected calendar window without filling calendar gaps", () => {
  const daily = Array.from({ length: 14 }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    netFlowUsd: index,
  }));

  const points = recentEtfFlowPoints({ daily }, "daily", 12);

  assert.equal(points.length, 12);
  assert.equal(points[0].date, "2026-07-03");
  assert.equal(points.at(-1).date, "2026-07-14");
});

test("ETF range filtering keeps real observations only", () => {
  const points = recentEtfFlowPoints({
    weekly: [
      { week: "2026-05-04", netFlowUsd: 8 },
      { week: "2026-06-29", netFlowUsd: null },
      { week: "2026-07-06", netFlowUsd: 5 },
    ],
  }, "weekly", 30);

  assert.deepEqual(points, [
    { date: "2026-06-29", value: null },
    { date: "2026-07-06", value: 5 },
  ]);
});

test("weekly ETF windows retain the boundary week represented on the weekly axis", () => {
  const points = recentEtfFlowPoints({
    weekly: [
      { week: "2026-06-22", netFlowUsd: 8 },
      { week: "2026-06-29", netFlowUsd: 9 },
      { week: "2026-07-13", netFlowUsd: 10, tradingDays: 2 },
    ],
  }, "weekly", 22, "2026-07-19T18:00:00Z");

  assert.deepEqual(points.map((point) => point.date), ["2026-06-22", "2026-06-29", "2026-07-13"]);
  assert.equal(points.at(-1).tradingDays, 2);
});

test("selected ranges are anchored to the dataset date instead of reviving stale ETF points", () => {
  const points = recentEtfFlowPoints({
    daily: [{ date: "2026-01-01", netFlowUsd: 8 }],
  }, "daily", 30, "2026-07-10T00:00:00Z");

  assert.deepEqual(points, []);
});

test("range filtering excludes observations after the requested window end", () => {
  const points = recentEtfFlowPoints({
    daily: [
      { date: "2026-07-09", netFlowUsd: 8 },
      { date: "2026-07-11", netFlowUsd: 9 },
    ],
  }, "daily", 30, "2026-07-10T00:00:00Z");

  assert.deepEqual(points, [{ date: "2026-07-09", value: 8 }]);
});

test("calendar ranges normalize an intraday generated timestamp to its UTC date", () => {
  const points = recentEtfFlowPoints({
    daily: [
      { date: "2026-07-15", netFlowUsd: 8 },
      { date: "2026-07-16", netFlowUsd: 9 },
    ],
  }, "daily", 2, "2026-07-16T18:30:00Z");

  assert.deepEqual(points, [
    { date: "2026-07-15", value: 8 },
    { date: "2026-07-16", value: 9 },
  ]);
});

test("calendar spacing leaves elapsed dates blank without inventing zero or missing observations", () => {
  const points = calendarSpacedPoints([
    { date: "2026-07-03", value: 8 },
    { date: "2026-07-06", value: -2 },
  ], "daily");

  assert.deepEqual(points, [
    { date: "2026-07-03", value: 8 },
    { date: "2026-07-04", value: null, isGap: true },
    { date: "2026-07-05", value: null, isGap: true },
    { date: "2026-07-06", value: -2 },
  ]);
});

test("calendar spacing preserves empty leading and trailing slots for the selected window", () => {
  const points = calendarSpacedPoints([
    { date: "2026-07-02", value: 8 },
    { date: "2026-07-04", value: -2 },
  ], "daily", { rangeDays: 5, windowEndDate: "2026-07-05T18:00:00Z" });

  assert.deepEqual(points, [
    { date: "2026-07-01", value: null, isGap: true },
    { date: "2026-07-02", value: 8 },
    { date: "2026-07-03", value: null, isGap: true },
    { date: "2026-07-04", value: -2 },
    { date: "2026-07-05", value: null, isGap: true },
  ]);
});

test("period changes break across a missing observation instead of bridging the gap", () => {
  const result = consecutivePeriodChanges([
    { date: "2026-07-01", value: 100 },
    { date: "2026-07-03", value: 110 },
    { date: "2026-07-04", value: 115 },
  ], ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"]);

  assert.deepEqual(result.map(({ date, change }) => ({ date, change })), [
    { date: "2026-07-01", change: null },
    { date: "2026-07-02", change: null },
    { date: "2026-07-03", change: null },
    { date: "2026-07-04", change: 5 },
  ]);
});

test("treasury demand prefers adjacent holding changes and falls back to disclosed acquisitions", () => {
  const points = recentTreasuryDemandPoints({
    history: [
      { holdingsObservedAt: "2026-06-01", holdings: 100, acquired: 7 },
      { holdingsObservedAt: "2026-06-08", holdings: 115, acquired: null },
      { holdingsObservedAt: "2026-06-15", holdings: 110, acquired: -4 },
      { holdingsObservedAt: "2026-06-22", holdings: null, acquired: null },
    ],
  });

  assert.deepEqual(points, [
    { date: "2026-06-01", value: 7 },
    { date: "2026-06-08", value: 15 },
    { date: "2026-06-15", value: -5 },
    { date: "2026-06-22", value: null },
  ]);
});

test("treasury demand is ordered and filtered by disclosure date, including intraday end-date observations", () => {
  const points = recentTreasuryDemandPoints({
    history: [
      { disclosedAt: "2026-07-06T18:00:00Z", holdingsObservedAt: "2026-06-28T19:00:00Z", holdings: 115, acquired: null },
      { disclosedAt: "2026-07-01T08:00:00Z", holdingsObservedAt: "2026-06-30T00:00:00Z", holdings: 100, acquired: 4 },
      { disclosedAt: "2026-07-10T23:00:00Z", holdingsObservedAt: "2026-07-09T00:00:00Z", holdings: 120, acquired: null },
    ],
  }, 10, "2026-07-10T02:00:00Z");

  assert.deepEqual(points, [
    { date: "2026-07-01T08:00:00Z", value: 4 },
    { date: "2026-07-06T18:00:00Z", value: 15 },
    { date: "2026-07-10T23:00:00Z", value: 5 },
  ]);
});

test("treasury demand does not derive across a missing holdings disclosure", () => {
  const points = recentTreasuryDemandPoints({
    history: [
      { disclosedAt: "2026-07-01", holdings: 100, acquired: 4 },
      { disclosedAt: "2026-07-02", holdings: null, acquired: 10 },
      { disclosedAt: "2026-07-03", holdings: 115, acquired: null },
    ],
  });

  assert.deepEqual(points, [
    { date: "2026-07-01", value: 4 },
    { date: "2026-07-02", value: 10 },
    { date: "2026-07-03", value: null },
  ]);
});

test("weekly metric history uses each week's final real observation without filling missing weeks", () => {
  const result = metricHistoryByCadence({
    "btc.marketCap": [
      { date: "2026-06-29", value: 100 },
      { date: "2026-07-03", value: 105 },
      { date: "2026-07-17", value: 98 },
    ],
  }, "weekly", 30);

  assert.deepEqual(result["btc.marketCap"], [
    { date: "2026-06-29", observedDate: "2026-07-03", value: 105 },
    { date: "2026-07-13", observedDate: "2026-07-17", value: 98 },
  ]);
});

test("daily metric history clips by calendar range and preserves explicit missing values", () => {
  const result = metricHistoryByCadence({
    metric: [
      { date: "2026-01-01", value: 1 },
      { date: "2026-07-09", value: null },
      { date: "2026-07-10", value: 3 },
    ],
  }, "daily", 2);

  assert.deepEqual(result.metric, [
    { date: "2026-07-09", observedDate: "2026-07-09", value: null },
    { date: "2026-07-10", observedDate: "2026-07-10", value: 3 },
  ]);
});

test("metric history uses the requested dataset window and rejects stale or future observations", () => {
  const result = metricHistoryByCadence({
    stale: [{ date: "2026-01-01", value: 1 }],
    bounded: [
      { date: "2026-07-15T18:00:00Z", value: 2 },
      { date: "2026-07-17T00:00:00Z", value: 3 },
    ],
  }, "daily", 2, "2026-07-16T20:00:00Z");

  assert.deepEqual(result.stale, []);
  assert.deepEqual(result.bounded, [
    { date: "2026-07-15", observedDate: "2026-07-15T18:00:00Z", value: 2 },
  ]);
});

test("cadence axes include completely missing periods so changes cannot bridge them", () => {
  const dates = cadenceDateAxis("weekly", 22, "2026-07-19T18:00:00Z");
  assert.deepEqual(dates, ["2026-06-22", "2026-06-29", "2026-07-06", "2026-07-13"]);
  const changes = consecutivePeriodChanges([
    { date: "2026-06-29", value: 100 },
    { date: "2026-07-13", value: 120 },
  ], dates);
  assert.deepEqual(changes.map((item) => item.change), [null, null, null, null]);
});

test("treasury range filtering derives changes before clipping the disclosure window", () => {
  const points = recentTreasuryDemandPoints({
    history: [
      { holdingsObservedAt: "2026-01-01", holdings: 100, acquired: null },
      { holdingsObservedAt: "2026-06-25", holdings: 125, acquired: null },
      { holdingsObservedAt: "2026-07-10", holdings: 130, acquired: null },
    ],
  }, 30);

  assert.deepEqual(points, [
    { date: "2026-06-25", value: 25 },
    { date: "2026-07-10", value: 5 },
  ]);
});
