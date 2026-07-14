function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function compactSeriesPoints(points) {
  const byTime = new Map();
  for (const point of points || []) {
    const value = finiteNumber(point?.v);
    const t = String(point?.t || "");
    if (!t || value == null || Number.isNaN(Date.parse(t))) continue;
    byTime.set(t, { t, v: value });
  }
  return [...byTime.values()].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
}

export function mergeLastKnownGoodPoints({ current, baseline, currentFetchedAt, baselineFetchedAt }) {
  const currentFetchMs = Date.parse(currentFetchedAt || "");
  const baselineFetchMs = Date.parse(baselineFetchedAt || "");
  const currentCanRevise = Number.isFinite(currentFetchMs)
    && (!Number.isFinite(baselineFetchMs) || currentFetchMs >= baselineFetchMs);
  return compactSeriesPoints(currentCanRevise
    ? [...(baseline || []), ...(current || [])]
    : [...(current || []), ...(baseline || [])]);
}
