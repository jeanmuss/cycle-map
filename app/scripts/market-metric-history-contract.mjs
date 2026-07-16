import {
  aggregateWeeklyFlows,
  attachHistoricalMetricFallbacks,
  attachMetricChanges,
  summarizeMetricHistory,
} from "./crypto-liquidity-contract.mjs";

function finiteNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function observationTimestamp(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== "" && item != null));
}

function row({
  metricId,
  observedAt,
  value,
  unit,
  cadence,
  source,
  sourceUrl,
  sourceKey,
  qualityStatus = "available",
  fetchedAt,
  lastCheckedAt,
  transformedAt,
  dimensions = {},
  metadata = {},
}) {
  const numericValue = finiteNumber(value);
  const timestamp = observationTimestamp(observedAt);
  if (!metricId || !timestamp || numericValue == null || !unit || !cadence || !source || !sourceKey) return null;
  return {
    metric_id: metricId,
    observed_at: timestamp,
    value: numericValue,
    unit,
    cadence,
    source,
    source_url: sourceUrl || null,
    source_key: sourceKey,
    quality_status: qualityStatus || "available",
    fetched_at: observationTimestamp(fetchedAt),
    last_checked_at: observationTimestamp(lastCheckedAt ?? fetchedAt),
    transformed_at: observationTimestamp(transformedAt),
    dimensions: compactObject(dimensions),
    metadata: compactObject(metadata),
  };
}

function sourceUrlForMetric(dataset, metric) {
  if (metric?.source === "cmc") return dataset?.sources?.cmc || null;
  return null;
}

function treasuryPointSource(treasury, point) {
  if (point?.source) return point.source;
  const url = String(point?.sourceUrl || "");
  if (url.includes("sec.gov/")) return "SEC EDGAR";
  if (url.includes("strategy.com/")) return "Strategy official Form 8-K";
  if (url.includes("sosovalue")) return "sosovalue";
  return treasury?.source || "official_disclosure";
}

export function extractCryptoHistoryRows(dataset) {
  if (!dataset) return [];
  const fetchedAt = dataset.timestamps?.fetchedAt;
  const transformedAt = dataset.timestamps?.transformedAt || dataset.generatedAt;
  const metrics = Object.fromEntries((dataset.metrics || []).map((item) => [item.id, item]));
  const rows = [];

  for (const [metricId, points] of Object.entries(dataset.history || {})) {
    const metric = metrics[metricId] || {};
    const metricSourceUrl = sourceUrlForMetric(dataset, metric);
    for (const point of points || []) {
      const source = point?.source || metric.source || "crypto-liquidity-cache";
      const dailyDate = /^\d{4}-\d{2}-\d{2}$/.test(point?.date || "")
        ? point.date
        : observationTimestamp(point?.observedAt)?.slice(0, 10);
      rows.push(row({
        metricId,
        observedAt: dailyDate ? `${dailyDate}T00:00:00.000Z` : null,
        value: point.value,
        unit: metric.unit || "number",
        cadence: "daily",
        source,
        sourceUrl: point?.sourceUrl || metricSourceUrl,
        sourceKey: point?.sourceKey || source,
        qualityStatus: point?.qualityStatus || (metric.value == null ? "stale_snapshot" : "available"),
        fetchedAt: point?.fetchedAt || null,
        lastCheckedAt: point?.lastCheckedAt || point?.fetchedAt || null,
        transformedAt,
        metadata: {
          semantics: metric.semantics,
          sourceObservedAt: observationTimestamp(point?.observedAt),
          ...(point?.metadata || {}),
        },
      }));
    }
  }

  for (const [asset, series] of Object.entries(dataset.etf || {})) {
    for (const point of series?.daily || []) {
      const source = point?.source || series.source || "sosovalue";
      rows.push(row({
        metricId: `crypto.etf.${asset}.net_flow_usd`,
        observedAt: point.date,
        value: point.netFlowUsd,
        unit: "USD",
        cadence: "daily",
        source,
        sourceUrl: point?.sourceUrl || series.sourceUrl || dataset.sources?.sosovalueEtf,
        sourceKey: point?.sourceKey || source,
        qualityStatus: point?.qualityStatus || series.qualityStatus || series.status || "available",
        fetchedAt: point?.fetchedAt || series.fetchedAt || null,
        lastCheckedAt: point?.lastCheckedAt || series.lastCheckedAt || point?.fetchedAt || series.fetchedAt || null,
        transformedAt,
        dimensions: { asset, countryCode: "US" },
        metadata: {
          cumulativeNetFlowUsd: finiteNumber(point.cumulativeNetFlowUsd),
          totalNetAssetsUsd: finiteNumber(point.totalNetAssetsUsd),
          totalValueTradedUsd: finiteNumber(point.totalValueTradedUsd),
        },
      }));
    }
  }

  for (const treasury of Object.values(dataset.corporateTreasuries || {})) {
    if (!treasury?.ticker || !treasury?.asset) continue;
    const ticker = treasury.ticker.toLowerCase();
    const asset = treasury.asset.toLowerCase();
    for (const point of treasury.history || []) {
      rows.push(row({
        metricId: `treasury.${ticker}.${asset}_holdings`,
        observedAt: point.holdingsObservedAt || point.date,
        value: point.holdings,
        unit: treasury.asset,
        cadence: "disclosure",
        source: treasuryPointSource(treasury, point),
        sourceUrl: point.sourceUrl || treasury.sourceUrl,
        sourceKey: point.sourceUrl || `${treasury.ticker}-holdings`,
        qualityStatus: point.qualityStatus || treasury.qualityStatus,
        fetchedAt,
        transformedAt,
        dimensions: { company: treasury.company, ticker: treasury.ticker, asset: treasury.asset },
        metadata: {
          disclosedAt: point.disclosedAt || point.date,
          acquired: finiteNumber(point.acquired),
          acquisitionCostUsd: finiteNumber(point.acquisitionCostUsd),
          providerReportedTransactionPriceUsd: finiteNumber(point.transactionPriceUsd),
        },
      }));
    }
    for (const point of treasury.costHistory || []) {
      rows.push(row({
        metricId: `treasury.${ticker}.${asset}_average_cost_usd`,
        observedAt: point.costObservedAt,
        value: point.averageCostUsd,
        unit: "USD_per_asset",
        cadence: "disclosure",
        source: treasuryPointSource(treasury, point),
        sourceUrl: point.sourceUrl || treasury.sourceUrl,
        sourceKey: point.sourceUrl || `${treasury.ticker}-cost`,
        qualityStatus: point.qualityStatus || treasury.qualityStatus,
        fetchedAt,
        transformedAt,
        dimensions: { company: treasury.company, ticker: treasury.ticker, asset: treasury.asset },
        metadata: {
          holdingsAtCostDate: finiteNumber(point.holdingsAtCostDate),
          costBasisUsd: finiteNumber(point.costBasisUsd),
          costBasisApproximate: point.costBasisApproximate === true,
          averageCostMethod: point.averageCostMethod,
        },
      }));
    }
  }

  return rows.filter(Boolean);
}

function jgbObservationsFromEquity(dataset) {
  const byDate = new Map();
  for (const day of dataset?.days || []) {
    const item = day?.macro?.JGB10Y;
    if (item?.date && finiteNumber(item.value) != null) byDate.set(item.date, { date: item.date, value: item.value });
  }
  return [...byDate.values()];
}

export function extractJapanRateRows(cache, equityDataset) {
  const meta = equityDataset?.macroSeries?.JGB10Y || {};
  const observations = Array.isArray(cache?.observations) && cache.observations.length
    ? cache.observations
    : jgbObservationsFromEquity(equityDataset);
  const fetchedAt = cache?.fetchedAt || equityDataset?.timestamps?.fetchedAt;
  const transformedAt = equityDataset?.timestamps?.transformedAt || equityDataset?.generatedAt;
  return observations.map((point) => row({
    metricId: "macro.JGB10Y.value",
    observedAt: point.date,
    value: point.value,
    unit: "percent",
    cadence: "daily",
    source: cache?.source || meta.source || "Japan Ministry of Finance",
    sourceUrl: cache?.sourceUrl || meta.historyUrl || meta.sourceUrl,
    sourceKey: "mof-jgb-cme-10y",
    qualityStatus: "official",
    fetchedAt,
    transformedAt,
    dimensions: { country: "JP", tenor: "10Y", sourceColumn: "10Y" },
    metadata: {
      dateMeaning: cache?.dateMeaning || meta.dateMeaning || "japan_market_close_1500_jst",
      methodologyUrl: meta.methodologyUrl,
    },
  })).filter(Boolean);
}

export function selectIncrementalObservationRows(rows, latestObservedAt, options = {}) {
  const initialBackfillDays = Number.isFinite(options.initialBackfillDays) ? options.initialBackfillDays : 400;
  const overlapDays = Number.isFinite(options.overlapDays) ? options.overlapDays : 14;
  const sorted = rows
    .filter((item) => Number.isFinite(Date.parse(item?.observed_at)))
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  if (!sorted.length) return [];

  const latestStoredAt = Date.parse(latestObservedAt);
  const hasStoredObservation = Number.isFinite(latestStoredAt);
  const anchor = hasStoredObservation
    ? latestStoredAt
    : Date.parse(sorted[sorted.length - 1].observed_at);
  const lookbackDays = hasStoredObservation ? overlapDays : initialBackfillDays;
  const boundary = anchor - (Math.max(0, lookbackDays) * 24 * 60 * 60 * 1000);
  return sorted.filter((item) => Date.parse(item.observed_at) >= boundary);
}

export function dedupeMarketMetricRows(rows) {
  const byKey = new Map();
  for (const item of rows.filter(Boolean)) {
    byKey.set(`${item.metric_id}::${item.observed_at}::${item.source_key}`, item);
  }
  return [...byKey.values()].sort((a, b) => {
    const metric = a.metric_id.localeCompare(b.metric_id);
    return metric || a.observed_at.localeCompare(b.observed_at) || a.source_key.localeCompare(b.source_key);
  });
}

const CRYPTO_LEVEL_METRIC_IDS = new Set([
  "crypto.totalMarketCap",
  "btc.marketCap",
  "stablecoin.usdt.marketCap",
  "stablecoin.usdc.marketCap",
  "stablecoin.major.marketCap",
  "stablecoin.usdt.depegBps",
]);

function rowDateKey(item) {
  const timestamp = observationTimestamp(item?.observed_at);
  return timestamp?.slice(0, 10) || null;
}

function preferredDatabaseSeries(rows, preferredSource = null) {
  const bySource = new Map();
  for (const item of rows || []) {
    const date = rowDateKey(item);
    const value = finiteNumber(item?.value);
    const sourceKey = String(item?.source_key || item?.source || "database");
    if (!date || value == null) continue;
    const byDate = bySource.get(sourceKey) || new Map();
    const existing = byDate.get(date);
    if (!existing || String(item.observed_at).localeCompare(String(existing.observed_at)) >= 0) byDate.set(date, item);
    bySource.set(sourceKey, byDate);
  }
  const freshnessToleranceMs = 2 * 24 * 60 * 60 * 1000;
  return [...bySource.entries()]
    .map(([sourceKey, byDate]) => {
      const sourceRows = [...byDate.values()];
      const endDate = sourceRows.map(rowDateKey).filter(Boolean).sort().at(-1) || null;
      return { sourceKey, rows: sourceRows, endDate, endTime: Date.parse(`${endDate}T00:00:00Z`) };
    })
    .sort((a, b) => {
      const endDateGap = Math.abs(a.endTime - b.endTime);
      if (endDateGap > freshnessToleranceMs) return b.endTime - a.endTime;
      const aPreferred = (a.sourceKey === preferredSource || a.rows[0]?.source === preferredSource) && a.rows.length >= 183 ? 1 : 0;
      const bPreferred = (b.sourceKey === preferredSource || b.rows[0]?.source === preferredSource) && b.rows.length >= 183 ? 1 : 0;
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;
      if (a.rows.length !== b.rows.length) return b.rows.length - a.rows.length;
      if (a.endTime !== b.endTime) return b.endTime - a.endTime;
      return a.sourceKey.localeCompare(b.sourceKey);
    })
    .at(0) || { sourceKey: null, rows: [] };
}

function databaseHistoryPoint(item) {
  const date = rowDateKey(item);
  const value = finiteNumber(item?.value);
  if (!date || value == null) return null;
  return {
    date,
    value,
    observedAt: observationTimestamp(item.metadata?.sourceObservedAt || item.observed_at),
    source: item.source,
    sourceUrl: item.source_url || null,
    sourceKey: item.source_key,
    fetchedAt: observationTimestamp(item.fetched_at),
    lastCheckedAt: observationTimestamp(item.last_checked_at),
    qualityStatus: item.quality_status || "database_last_known_good",
    ...(item.metadata && Object.keys(item.metadata).length ? { metadata: item.metadata } : {}),
  };
}

export function hydrateCryptoDatasetFromRows(dataset, rows, syncedAt = new Date().toISOString()) {
  const safeDataset = dataset || {};
  const metricsById = Object.fromEntries((safeDataset.metrics || []).map((item) => [item.id, item]));
  const grouped = new Map();
  for (const item of rows || []) {
    if (!item?.metric_id) continue;
    const current = grouped.get(item.metric_id) || [];
    current.push(item);
    grouped.set(item.metric_id, current);
  }

  const history = { ...(safeDataset.history || {}) };
  for (const metricId of CRYPTO_LEVEL_METRIC_IDS) {
    const selected = preferredDatabaseSeries(grouped.get(metricId), metricsById[metricId]?.source === "defillama" ? "defillama" : "cmc");
    const points = selected.rows.map(databaseHistoryPoint).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
    if (points.length) history[metricId] = points;
  }

  const etf = { ...(safeDataset.etf || {}) };
  for (const [metricId, metricRows] of grouped.entries()) {
    const match = metricId.match(/^crypto\.etf\.([A-Z0-9]+)\.net_flow_usd$/);
    if (!match) continue;
    const asset = match[1];
    const selected = preferredDatabaseSeries(metricRows, etf[asset]?.source);
    const daily = selected.rows.map((item) => ({
      date: rowDateKey(item),
      netFlowUsd: finiteNumber(item.value),
      cumulativeNetFlowUsd: finiteNumber(item.metadata?.cumulativeNetFlowUsd),
      totalNetAssetsUsd: finiteNumber(item.metadata?.totalNetAssetsUsd),
      totalValueTradedUsd: finiteNumber(item.metadata?.totalValueTradedUsd),
      observedAt: observationTimestamp(item.observed_at),
      source: item.source,
      sourceUrl: item.source_url || null,
      sourceKey: item.source_key,
      fetchedAt: observationTimestamp(item.fetched_at),
      lastCheckedAt: observationTimestamp(item.last_checked_at),
      qualityStatus: item.quality_status || "database_last_known_good",
    })).filter((item) => item.date && item.netFlowUsd != null).sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
    if (!daily.length) continue;
    etf[asset] = {
      ...(etf[asset] || {}),
      asset,
      cadence: "daily",
      status: "available",
      source: daily.at(-1)?.source || selected.sourceKey || etf[asset]?.source,
      sourceUrl: daily.at(-1)?.sourceUrl || etf[asset]?.sourceUrl || null,
      observedAt: daily.at(-1).date,
      fetchedAt: daily.at(-1)?.fetchedAt || null,
      lastCheckedAt: daily.at(-1)?.lastCheckedAt || null,
      qualityStatus: "database_last_known_good",
      daily,
      weekly: aggregateWeeklyFlows(daily),
    };
  }

  const corporateTreasuries = { ...(safeDataset.corporateTreasuries || {}) };
  for (const [metricId, metricRows] of grouped.entries()) {
    const match = metricId.match(/^treasury\.([a-z0-9]+)\.([a-z0-9]+)_holdings$/);
    if (!match) continue;
    const ticker = match[1].toUpperCase();
    const treasury = corporateTreasuries[ticker] || {};
    const disclosureRows = metricRows.map((item) => ({
      ...item,
      holdings_observed_at: item.observed_at,
      observed_at: observationTimestamp(item.metadata?.disclosedAt || item.observed_at),
      source_key: item.source || item.source_key,
    }));
    const selected = preferredDatabaseSeries(disclosureRows, treasury.source);
    const history = selected.rows.map((item) => ({
      disclosedAt: observationTimestamp(item.metadata?.disclosedAt || item.observed_at)?.slice(0, 10),
      holdingsObservedAt: observationTimestamp(item.holdings_observed_at || item.observed_at),
      holdings: finiteNumber(item.value),
      acquired: finiteNumber(item.metadata?.acquired),
      acquisitionCostUsd: finiteNumber(item.metadata?.acquisitionCostUsd),
      transactionPriceUsd: finiteNumber(item.metadata?.providerReportedTransactionPriceUsd),
      source: item.source,
      sourceUrl: item.source_url || null,
      sourceKey: item.source_key,
      fetchedAt: observationTimestamp(item.fetched_at),
      lastCheckedAt: observationTimestamp(item.last_checked_at),
      qualityStatus: item.quality_status || "database_last_known_good",
    })).filter((item) => item.disclosedAt && item.holdings != null)
      .sort((left, right) => left.disclosedAt.localeCompare(right.disclosedAt) || left.holdingsObservedAt.localeCompare(right.holdingsObservedAt))
      .slice(-400);
    if (!history.length) continue;
    corporateTreasuries[ticker] = {
      ...treasury,
      history,
      historySource: history.at(-1)?.source || selected.sourceKey || null,
      historyQualityStatus: "database_last_known_good",
    };
  }

  let metrics = attachHistoricalMetricFallbacks(safeDataset.metrics || [], history);
  metrics = attachMetricChanges(metrics, history);
  const etfObservedAt = Object.values(etf)
    .filter((item) => item?.status === "available" && item.observedAt)
    .map((item) => item.observedAt)
    .sort()
    .at(0) || safeDataset.sectionObservedAt?.etf || null;
  return {
    ...safeDataset,
    generatedAt: syncedAt,
    timestamps: { ...(safeDataset.timestamps || {}), transformedAt: syncedAt },
    sectionObservedAt: { ...(safeDataset.sectionObservedAt || {}), etf: etfObservedAt },
    metrics,
    history,
    historyCoverage: summarizeMetricHistory(history),
    etf,
    corporateTreasuries,
    databaseSync: {
      syncedAt,
      observationsRead: (rows || []).length,
      role: "service_side_last_known_good_hydration",
    },
  };
}
