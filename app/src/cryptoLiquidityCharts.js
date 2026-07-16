function observationDate(point) {
  return point?.date || point?.week || point?.holdingsObservedAt || point?.disclosedAt || null;
}

function treasuryDisclosureDate(point) {
  return point?.disclosedAt || point?.holdingsObservedAt || point?.date || null;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function utcDateTimestamp(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function pointsInRange(points, rangeDays, windowEndDate, options = {}) {
  const datedPoints = points.map((point) => ({
    ...point,
    timestamp: utcDateTimestamp(point.date),
  }));
  const timestamps = datedPoints.map((point) => point.timestamp).filter(Number.isFinite);
  if (!timestamps.length) return [];

  const requestedWindowEnd = utcDateTimestamp(windowEndDate);
  const latestTimestamp = Number.isFinite(requestedWindowEnd)
    ? requestedWindowEnd
    : Math.max(...timestamps);
  const days = Number.isFinite(Number(rangeDays)) ? Math.max(1, Number(rangeDays)) : 30;
  const requestedCutoff = latestTimestamp - ((days - 1) * 86_400_000);
  const cutoff = options.alignToWeek
    ? Date.parse(`${utcWeekStart(requestedCutoff)}T00:00:00Z`)
    : requestedCutoff;

  return datedPoints
    .filter((point) => (
      Number.isFinite(point.timestamp)
      && point.timestamp >= cutoff
      && point.timestamp <= latestTimestamp
    ))
    .sort((left, right) => left.timestamp - right.timestamp)
    .map(({ timestamp: _timestamp, ...point }) => point);
}

export function calendarSpacedPoints(points, cadence = "daily", options = {}) {
  const datedPoints = (points || [])
    .map((point) => ({ ...point, timestamp: utcDateTimestamp(point?.date) }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);
  if (!datedPoints.length) return [];

  const fallbackEnd = datedPoints.at(-1).timestamp;
  const fallbackStart = datedPoints[0].timestamp;
  const fallbackDays = Math.round((fallbackEnd - fallbackStart) / 86_400_000) + 1;
  const hasRequestedWindow = Number.isFinite(Number(options.rangeDays))
    && Number.isFinite(utcDateTimestamp(options.windowEndDate));
  const axis = cadenceDateAxis(
    cadence,
    hasRequestedWindow ? Number(options.rangeDays) : fallbackDays,
    hasRequestedWindow ? options.windowEndDate : new Date(fallbackEnd).toISOString(),
  );
  const byDate = new Map();
  datedPoints.forEach((point) => {
    const date = new Date(point.timestamp).toISOString().slice(0, 10);
    const current = byDate.get(date) || [];
    const { timestamp: _timestamp, ...cleanPoint } = point;
    current.push({ ...cleanPoint, date });
    byDate.set(date, current);
  });

  return axis.flatMap((date) => byDate.get(date) || [{ date, value: null, isGap: true }]);
}

export function recentEtfFlowPoints(asset, cadence, rangeDays = 30, windowEndDate) {
  const source = cadence === "weekly" ? asset?.weekly : asset?.daily;
  if (!Array.isArray(source)) return [];

  return pointsInRange(source.map((point) => ({
    date: observationDate(point),
    value: finiteOrNull(point?.netFlowUsd),
    ...(Number.isFinite(point?.tradingDays) ? { tradingDays: point.tradingDays } : {}),
  })), rangeDays, windowEndDate, { alignToWeek: cadence === "weekly" });
}

export function recentTreasuryDemandPoints(treasury, rangeDays = 30, windowEndDate) {
  const history = Array.isArray(treasury?.history)
    ? [...treasury.history].sort((left, right) => (
      (utcDateTimestamp(treasuryDisclosureDate(left)) ?? Number.POSITIVE_INFINITY)
      - (utcDateTimestamp(treasuryDisclosureDate(right)) ?? Number.POSITIVE_INFINITY)
    ))
    : [];
  let previousHoldings = null;

  const points = history.map((point) => {
    const holdings = finiteOrNull(point?.holdings);
    const explicitAcquisition = finiteOrNull(point?.acquired);
    const derivedChange = holdings !== null && previousHoldings !== null
      ? holdings - previousHoldings
      : null;
    const value = derivedChange ?? explicitAcquisition;

    previousHoldings = holdings;

    return {
      date: treasuryDisclosureDate(point),
      value,
    };
  });

  return pointsInRange(points, rangeDays, windowEndDate);
}

export function flowChartScale(points) {
  const values = (points || [])
    .map((point) => point?.value)
    .filter(Number.isFinite);

  return {
    finiteCount: values.length,
    maxAbsoluteValue: values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0),
  };
}

export function consecutivePeriodChanges(points, dates) {
  const byDate = new Map((points || []).map((point) => [point?.date, point]));
  let previous = null;
  return (dates || []).map((date) => {
    const point = byDate.get(date);
    const value = finiteOrNull(point?.value);
    const change = value !== null && previous !== null ? value - previous : null;
    previous = value;
    return { date, point, change };
  });
}

function utcWeekStart(timestamp) {
  const date = new Date(timestamp);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function cadenceDateAxis(cadence, rangeDays = 30, windowEndDate) {
  const windowEnd = utcDateTimestamp(windowEndDate);
  if (!Number.isFinite(windowEnd)) return [];
  const days = Number.isFinite(Number(rangeDays)) ? Math.max(1, Number(rangeDays)) : 30;
  const cutoff = windowEnd - ((days - 1) * 86_400_000);
  const start = cadence === "weekly" ? Date.parse(`${utcWeekStart(cutoff)}T00:00:00Z`) : cutoff;
  const end = cadence === "weekly" ? Date.parse(`${utcWeekStart(windowEnd)}T00:00:00Z`) : windowEnd;
  const step = cadence === "weekly" ? 7 * 86_400_000 : 86_400_000;
  const dates = [];
  for (let timestamp = start; timestamp <= end; timestamp += step) {
    dates.push(new Date(timestamp).toISOString().slice(0, 10));
  }
  return dates;
}

export function metricHistoryByCadence(history, cadence, rangeDays = 30, windowEndDate) {
  const entries = Object.entries(history || {});
  const timestamps = entries
    .flatMap(([, points]) => Array.isArray(points) ? points : [])
    .map((point) => utcDateTimestamp(point?.date))
    .filter(Number.isFinite);
  if (!timestamps.length) return {};

  const requestedWindowEnd = utcDateTimestamp(windowEndDate);
  const windowEnd = Number.isFinite(requestedWindowEnd) ? requestedWindowEnd : Math.max(...timestamps);
  const days = Number.isFinite(Number(rangeDays)) ? Math.max(1, Number(rangeDays)) : 30;
  const cutoff = windowEnd - ((days - 1) * 86_400_000);

  return Object.fromEntries(entries.map(([metricId, source]) => {
    const points = (Array.isArray(source) ? source : [])
      .map((point) => ({
        observedDate: point?.date || null,
        timestamp: utcDateTimestamp(point?.date),
        value: finiteOrNull(point?.value),
      }))
      .filter((point) => Number.isFinite(point.timestamp) && point.timestamp >= cutoff && point.timestamp <= windowEnd)
      .sort((left, right) => left.timestamp - right.timestamp);

    const byPeriod = new Map();
    points.forEach((point) => {
      const period = cadence === "weekly"
        ? utcWeekStart(point.timestamp)
        : new Date(point.timestamp).toISOString().slice(0, 10);
      byPeriod.set(period, {
        date: period,
        observedDate: point.observedDate,
        value: point.value,
      });
    });

    return [metricId, [...byPeriod.values()]];
  }));
}
