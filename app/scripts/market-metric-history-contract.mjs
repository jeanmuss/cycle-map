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
    last_checked_at: observationTimestamp(fetchedAt),
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
    const sourceUrl = sourceUrlForMetric(dataset, metric);
    for (const point of points || []) {
      rows.push(row({
        metricId,
        observedAt: point.date,
        value: point.value,
        unit: metric.unit || "number",
        cadence: "daily",
        source: metric.source || "crypto-liquidity-cache",
        sourceUrl,
        sourceKey: metric.source || "crypto-liquidity-cache",
        qualityStatus: metric.value == null ? "stale_snapshot" : "available",
        fetchedAt,
        transformedAt,
        metadata: { semantics: metric.semantics },
      }));
    }
  }

  for (const [asset, series] of Object.entries(dataset.etf || {})) {
    for (const point of series?.daily || []) {
      rows.push(row({
        metricId: `crypto.etf.${asset}.net_flow_usd`,
        observedAt: point.date,
        value: point.netFlowUsd,
        unit: "USD",
        cadence: "daily",
        source: series.source || "sosovalue",
        sourceUrl: dataset.sources?.sosovalueEtf,
        sourceKey: series.source || "sosovalue",
        qualityStatus: series.status || "available",
        fetchedAt,
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
