import {
  attachMetricChanges,
  attachTreasurySpotPrice,
  mergeHistoricalMetricSeries,
  mergeSosoEtfHistory,
  summarizeMetricHistory,
} from "./crypto-liquidity-contract.mjs";

const METRIC_DYNAMIC_FIELDS = [
  "value",
  "observedAt",
  "source",
  "sourceUrl",
  "sourceKey",
  "fetchedAt",
  "lastCheckedAt",
  "qualityStatus",
  "changePct24h",
  "price",
];

const QUOTE_DYNAMIC_FIELDS = [
  "localQuote",
  "price",
  "changePct",
  "changeBasis",
  "asOf",
  "sourceKind",
  "sourceLabel",
  "quality",
  "components",
  "fetchedAt",
];

const MARKET_CAP_DYNAMIC_FIELDS = [
  "marketCapUsd",
  "marketCapStatus",
  "marketCapAsOf",
  "marketCapSourceLabel",
  "marketCapFetchedAt",
];

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compareValidity(candidate, current) {
  const candidateValid = finiteNumber(candidate) != null ? 1 : 0;
  const currentValid = finiteNumber(current) != null ? 1 : 0;
  return candidateValid - currentValid;
}

function transformationTime(value) {
  const parsed = timestamp(value || new Date().toISOString());
  if (parsed == null) throw new Error("Invalid merge transformation time");
  return new Date(parsed).toISOString();
}

export function latestIso(values) {
  const latest = (values || [])
    .map((value) => ({ value, parsed: timestamp(value) }))
    .filter((item) => item.parsed != null)
    .sort((a, b) => a.parsed - b.parsed)
    .at(-1);
  return latest ? new Date(latest.parsed).toISOString() : null;
}

function isNewer(candidate, baseline) {
  const candidateTime = timestamp(candidate);
  const baselineTime = timestamp(baseline);
  return candidateTime != null && (baselineTime == null || candidateTime > baselineTime);
}

function copyDefined(target, source, fields) {
  const next = { ...(target || {}) };
  for (const field of fields) {
    if (source?.[field] !== undefined) next[field] = source[field];
  }
  return next;
}

function collectTimestampFields(value, keys, output = []) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectTimestampFields(item, keys, output);
    return output;
  }
  for (const [key, item] of Object.entries(value)) {
    if (keys.has(key) && typeof item === "string") output.push(item);
    else if (item && typeof item === "object") collectTimestampFields(item, keys, output);
  }
  return output;
}

function pointRevisionTime(point) {
  return timestamp(point?.observedAt || point?.date) ?? Number.NEGATIVE_INFINITY;
}

function pointFetchTime(point) {
  return timestamp(point?.fetchedAt) ?? Number.NEGATIVE_INFINITY;
}

function pointRichness(point) {
  return Object.values(point || {}).filter((value) => value !== "" && value != null).length;
}

function compareRevision(candidate, current, preferredSource = null) {
  if (!current) return 1;
  if (!candidate) return -1;
  const currentPreferred = preferredSource && current.source === preferredSource ? 1 : 0;
  const candidatePreferred = preferredSource && candidate.source === preferredSource ? 1 : 0;
  if (candidatePreferred !== currentPreferred) return candidatePreferred - currentPreferred;
  if (pointRevisionTime(candidate) !== pointRevisionTime(current)) {
    return pointRevisionTime(candidate) - pointRevisionTime(current);
  }
  if (pointFetchTime(candidate) !== pointFetchTime(current)) {
    return pointFetchTime(candidate) - pointFetchTime(current);
  }
  if (pointRichness(candidate) !== pointRichness(current)) {
    return pointRichness(candidate) - pointRichness(current);
  }
  return 0;
}

function chooseRevision(current, candidate, preferredSource = null) {
  return compareRevision(candidate, current, preferredSource) >= 0 ? candidate : current;
}

function mergeMetric(localMetric, remoteMetric, localDataset, remoteDataset) {
  const localRevision = localMetric ? {
    ...localMetric,
    fetchedAt: localMetric.fetchedAt || localDataset?.timestamps?.fetchedAt || null,
  } : null;
  const remoteRevision = remoteMetric ? {
    ...remoteMetric,
    fetchedAt: remoteMetric.fetchedAt || remoteDataset?.timestamps?.fetchedAt || null,
  } : null;
  if (!localMetric) return remoteRevision;
  const validity = compareValidity(remoteMetric?.value, localMetric?.value);
  if (
    !remoteMetric
    || validity < 0
    || (validity === 0 && compareRevision(remoteRevision, localRevision) <= 0)
  ) return localRevision;
  const next = copyDefined(localMetric, remoteRevision, METRIC_DYNAMIC_FIELDS);
  for (const field of ["value", "price"]) {
    if (remoteMetric[field] == null && localMetric[field] != null) next[field] = localMetric[field];
  }
  if (!next.sourceUrl && next.source === "cmc") {
    next.sourceUrl = remoteDataset?.sources?.cmc || localMetric.sourceUrl || null;
  }
  if (!next.fetchedAt) next.fetchedAt = remoteDataset?.timestamps?.fetchedAt || null;
  if (!next.lastCheckedAt) next.lastCheckedAt = next.fetchedAt;
  return next;
}

function mergeSpotPrice(localSpot, remoteSpot, localDataset, remoteDataset) {
  const localRevision = localSpot ? {
    ...localSpot,
    fetchedAt: localSpot.fetchedAt || localDataset?.timestamps?.fetchedAt || null,
  } : null;
  const remoteRevision = remoteSpot ? {
    ...remoteSpot,
    fetchedAt: remoteSpot.fetchedAt || remoteDataset?.timestamps?.fetchedAt || null,
  } : null;
  if (!localSpot) return remoteRevision;
  const validity = compareValidity(remoteSpot?.priceUsd, localSpot?.priceUsd);
  if (
    !remoteSpot
    || validity < 0
    || (validity === 0 && compareRevision(remoteRevision, localRevision) <= 0)
  ) return localRevision;
  return { ...localSpot, ...remoteRevision };
}

function historyWithDatasetProvenance(dataset) {
  const metrics = new Map((dataset?.metrics || []).map((item) => [item.id, item]));
  return Object.fromEntries(Object.entries(dataset?.history || {}).map(([metricId, points]) => {
    const metric = metrics.get(metricId) || {};
    const metricSource = metric.source || "remote-data-cache";
    const metricSourceUrl = metric.sourceUrl
      || (metricSource === "cmc" ? dataset?.sources?.cmc : null)
      || null;
    const metricFetchedAt = metric.fetchedAt || dataset?.timestamps?.fetchedAt || null;
    return [metricId, (points || []).map((point) => {
      const source = point.source || metricSource;
      const inheritsMetricProvenance = !point.source || point.source === metricSource;
      const explicitSourceUrl = !inheritsMetricProvenance && point.sourceUrl === metricSourceUrl
        ? null
        : point.sourceUrl;
      const explicitFetchedAt = !inheritsMetricProvenance && point.fetchedAt === metricFetchedAt
        ? null
        : point.fetchedAt;
      const explicitLastCheckedAt = !inheritsMetricProvenance && point.lastCheckedAt === metricFetchedAt
        ? null
        : point.lastCheckedAt;
      const fetchedAt = explicitFetchedAt || (inheritsMetricProvenance ? metricFetchedAt : null);
      return {
        ...point,
        observedAt: point.observedAt || (point.date ? `${point.date}T00:00:00.000Z` : null),
        source,
        sourceUrl: explicitSourceUrl || (inheritsMetricProvenance ? metricSourceUrl : null),
        sourceKey: point.sourceKey || source,
        fetchedAt,
        lastCheckedAt: explicitLastCheckedAt || explicitFetchedAt || (inheritsMetricProvenance ? metricFetchedAt : null),
        qualityStatus: point.qualityStatus || metric.qualityStatus || "available",
      };
    })];
  }));
}

function mergeHistoryByRevision(local, remote, selectedMetrics) {
  const localHistory = historyWithDatasetProvenance(local);
  const remoteHistory = historyWithDatasetProvenance(remote);
  const metricSources = new Map((selectedMetrics || []).map((item) => [item.id, item.source || null]));
  const metricIds = [...new Set([...Object.keys(remoteHistory), ...Object.keys(localHistory)])];
  const selected = {};
  for (const metricId of metricIds) {
    const byDate = new Map();
    for (const point of [...(remoteHistory[metricId] || []), ...(localHistory[metricId] || [])]) {
      const date = String(point?.date || point?.observedAt || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || finiteNumber(point?.value) == null) continue;
      byDate.set(date, chooseRevision(byDate.get(date), { ...point, date }, metricSources.get(metricId)));
    }
    selected[metricId] = [...byDate.values()];
  }
  return mergeHistoricalMetricSeries({}, selected);
}

function etfPointWithProvenance(point, series, dataset) {
  const source = point?.source || series?.source || "remote-data-cache";
  const fetchedAt = point?.fetchedAt || series?.fetchedAt || dataset?.timestamps?.fetchedAt || null;
  return {
    ...point,
    source,
    sourceUrl: point?.sourceUrl || series?.sourceUrl || null,
    sourceKey: point?.sourceKey || source,
    fetchedAt,
    lastCheckedAt: point?.lastCheckedAt || point?.fetchedAt || series?.lastCheckedAt || fetchedAt,
    qualityStatus: point?.qualityStatus || series?.qualityStatus || "available",
  };
}

function mergeEtf(localEtf, remoteEtf, localDataset, remoteDataset) {
  const assets = [...new Set([
    ...Object.keys(remoteEtf || {}),
    ...Object.keys(localEtf || {}),
  ])];
  return Object.fromEntries(assets.map((asset) => {
    const localAsset = localEtf?.[asset];
    const remoteAsset = remoteEtf?.[asset];
    const localRevision = localAsset ? {
      ...localAsset,
      fetchedAt: localAsset.fetchedAt || localDataset?.timestamps?.fetchedAt || null,
    } : null;
    const remoteRevision = remoteAsset ? {
      ...remoteAsset,
      fetchedAt: remoteAsset.fetchedAt || remoteDataset?.timestamps?.fetchedAt || null,
    } : null;
    const base = compareRevision(remoteRevision, localRevision) > 0
      ? remoteRevision
      : (localRevision || remoteRevision);
    const preferredSource = base?.source || null;
    const byDate = new Map();
    const remotePoints = (remoteAsset?.daily || []).map((point) => etfPointWithProvenance(point, remoteAsset, remoteDataset));
    const localPoints = (localAsset?.daily || []).map((point) => etfPointWithProvenance(point, localAsset, localDataset));
    for (const point of [...remotePoints, ...localPoints]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(point?.date || "") || finiteNumber(point?.netFlowUsd) == null) continue;
      byDate.set(point.date, chooseRevision(byDate.get(point.date), point, preferredSource));
    }
    return [asset, mergeSosoEtfHistory(null, { ...(base || {}), daily: [...byDate.values()] })];
  }));
}

function mergeTreasuries(localTreasuries, remoteTreasuries, spotPrices) {
  const tickers = [...new Set([
    ...Object.keys(remoteTreasuries || {}),
    ...Object.keys(localTreasuries || {}),
  ])];
  return Object.fromEntries(tickers.map((ticker) => {
    // The local snapshot contains the reviewed primary disclosure. Remote cache
    // history may be newer by date but is not allowed to replace that top-level
    // official value without a separate provider review.
    const treasury = localTreasuries?.[ticker] || remoteTreasuries?.[ticker];
    return [ticker, attachTreasurySpotPrice(treasury, spotPrices?.[treasury?.asset])];
  }));
}

export function mergeCryptoLiquiditySnapshots(local, remote, options = {}) {
  if (!local || !remote) throw new Error("Both crypto-liquidity snapshots are required");
  if (Number(remote.version || 0) > Number(local.version || 0)) {
    throw new Error(`Remote crypto-liquidity schema v${remote.version} is newer than local v${local.version}`);
  }

  const localMetrics = new Map((local.metrics || []).map((item) => [item.id, item]));
  const remoteMetrics = new Map((remote.metrics || []).map((item) => [item.id, item]));
  const metricIds = [...new Set([...localMetrics.keys(), ...remoteMetrics.keys()])];
  const selectedMetrics = metricIds.map((id) => mergeMetric(
    localMetrics.get(id),
    remoteMetrics.get(id),
    local,
    remote,
  ));
  const mergedHistory = mergeHistoryByRevision(local, remote, selectedMetrics);
  const metrics = attachMetricChanges(selectedMetrics, mergedHistory);
  const spotAssets = [...new Set([
    ...Object.keys(remote.spotPrices || {}),
    ...Object.keys(local.spotPrices || {}),
  ])];
  const spotPrices = Object.fromEntries(spotAssets.map((asset) => [
    asset,
    mergeSpotPrice(local.spotPrices?.[asset], remote.spotPrices?.[asset], local, remote),
  ]));
  const etf = mergeEtf(local.etf, remote.etf, local, remote);
  const corporateTreasuries = mergeTreasuries(
    local.corporateTreasuries,
    remote.corporateTreasuries,
    spotPrices,
  );
  const transformedAt = transformationTime(options.now);
  const levelObservedAt = latestIso(metrics.map((item) => item.observedAt));
  const etfObservedAt = latestIso(Object.values(etf).map((item) => item.observedAt));
  const treasuryObservedAt = latestIso(Object.values(corporateTreasuries).flatMap((item) => [
    item?.holdingsDisclosedAt,
    item?.holdingsObservedAt,
  ]));
  const fetchedAt = latestIso([
    local.timestamps?.fetchedAt,
    remote.timestamps?.fetchedAt,
    ...collectTimestampFields({ metrics, mergedHistory, etf }, new Set(["fetchedAt"])),
  ]);

  return {
    ...remote,
    ...local,
    version: local.version,
    generatedAt: transformedAt,
    timestamps: {
      ...(remote.timestamps || {}),
      ...(local.timestamps || {}),
      observedAt: levelObservedAt,
      fetchedAt,
      transformedAt,
    },
    sectionObservedAt: {
      ...(remote.sectionObservedAt || {}),
      ...(local.sectionObservedAt || {}),
      levels: levelObservedAt,
      etf: etfObservedAt,
      corporateTreasuries: treasuryObservedAt,
    },
    metrics,
    history: mergedHistory,
    historyCoverage: summarizeMetricHistory(mergedHistory),
    etf,
    spotPrices,
    corporateTreasuries,
    sources: { ...(remote.sources || {}), ...(local.sources || {}) },
  };
}

function assetWithDatasetProvenance(asset, dataset) {
  if (!asset) return asset;
  return {
    ...asset,
    ...(finiteNumber(asset.price) != null && !asset.fetchedAt
      ? { fetchedAt: dataset?.timestamps?.fetchedAt || null }
      : {}),
    ...(finiteNumber(asset.marketCapUsd) != null && !asset.marketCapFetchedAt
      ? { marketCapFetchedAt: dataset?.timestamps?.fetchedAt || null }
      : {}),
  };
}

function mergeAsset(localAsset, remoteAsset, localDataset, remoteDataset) {
  if (!localAsset) return assetWithDatasetProvenance(remoteAsset, remoteDataset);
  if (!remoteAsset) return assetWithDatasetProvenance(localAsset, localDataset);
  let next = assetWithDatasetProvenance(localAsset, localDataset);
  const localQuoteRevision = {
    source: localAsset.sourceKind,
    observedAt: localAsset.asOf,
    fetchedAt: localAsset.fetchedAt || localDataset?.timestamps?.fetchedAt || null,
  };
  const remoteQuoteRevision = {
    source: remoteAsset.sourceKind,
    observedAt: remoteAsset.asOf,
    fetchedAt: remoteAsset.fetchedAt || remoteDataset?.timestamps?.fetchedAt || null,
  };
  const quoteValidity = compareValidity(remoteAsset.price, localAsset.price);
  if (
    timestamp(remoteAsset.asOf) != null
    && (quoteValidity > 0 || (quoteValidity === 0 && compareRevision(remoteQuoteRevision, localQuoteRevision) > 0))
  ) {
    next = copyDefined(next, { ...remoteAsset, fetchedAt: remoteQuoteRevision.fetchedAt }, QUOTE_DYNAMIC_FIELDS);
  }
  const localCapRevision = {
    source: localAsset.marketCapSourceLabel,
    observedAt: localAsset.marketCapAsOf,
    fetchedAt: localAsset.marketCapFetchedAt || localDataset?.timestamps?.fetchedAt || null,
  };
  const remoteCapRevision = {
    source: remoteAsset.marketCapSourceLabel,
    observedAt: remoteAsset.marketCapAsOf,
    fetchedAt: remoteAsset.marketCapFetchedAt || remoteDataset?.timestamps?.fetchedAt || null,
  };
  const capValidity = compareValidity(remoteAsset.marketCapUsd, localAsset.marketCapUsd);
  if (
    timestamp(remoteAsset.marketCapAsOf) != null
    && (capValidity > 0 || (capValidity === 0 && compareRevision(remoteCapRevision, localCapRevision) > 0))
  ) {
    next = copyDefined(next, {
      ...remoteAsset,
      marketCapFetchedAt: remoteCapRevision.fetchedAt,
    }, MARKET_CAP_DYNAMIC_FIELDS);
  }
  return next;
}

export function mergeMarketSessionSnapshots(local, remote, options = {}) {
  if (!local || !remote) throw new Error("Both market-session snapshots are required");
  if (Number(remote.version || 0) > Number(local.version || 0)) {
    throw new Error(`Remote market-session schema v${remote.version} is newer than local v${local.version}`);
  }
  const localAssets = new Map((local.assets || []).map((item) => [item.symbol, item]));
  const remoteAssets = new Map((remote.assets || []).map((item) => [item.symbol, item]));
  const symbols = [...new Set([...localAssets.keys(), ...remoteAssets.keys()])];
  const assets = symbols.map((symbol) => mergeAsset(
    localAssets.get(symbol),
    remoteAssets.get(symbol),
    local,
    remote,
  ));
  const transformedAt = transformationTime(options.now);
  const observedAt = latestIso(assets.flatMap((asset) => [
    finiteNumber(asset.price) != null ? asset.asOf : null,
    finiteNumber(asset.marketCapUsd) != null ? asset.marketCapAsOf : null,
  ]));
  const fetchedAt = latestIso(assets.flatMap((asset) => [
    finiteNumber(asset.price) != null ? asset.fetchedAt : null,
    finiteNumber(asset.marketCapUsd) != null ? asset.marketCapFetchedAt : null,
  ])) || latestIso([local.timestamps?.fetchedAt, remote.timestamps?.fetchedAt]);
  return {
    ...remote,
    ...local,
    version: local.version,
    generatedAt: transformedAt,
    timestamps: {
      ...(remote.timestamps || {}),
      ...(local.timestamps || {}),
      observedAt,
      fetchedAt,
      transformedAt,
    },
    failures: remote.failures || local.failures || [],
    markets: local.markets,
    assets,
    sources: { ...(remote.sources || {}), ...(local.sources || {}) },
  };
}

function snapshotFreshness(snapshot) {
  return latestIso([snapshot?.generatedAt, snapshot?.updatedAt, snapshot?.asOf]);
}

function contract(condition, message) {
  if (!condition) throw new Error(`Data-cache contract failed: ${message}`);
}

function sortedUnique(rows, key, label) {
  const values = (rows || []).map(key);
  contract(values.every(Boolean), `${label} contains an invalid key`);
  contract(new Set(values).size === values.length, `${label} contains duplicate keys`);
  contract(values.every((value, index) => index === 0 || value >= values[index - 1]), `${label} is not sorted`);
}

function superset(remoteKeys, localKeys, label) {
  const remote = new Set(remoteKeys);
  contract(localKeys.every((key) => remote.has(key)), `${label} dropped existing keys`);
}

function latestKey(rows, key) {
  return (rows || []).map(key).filter(Boolean).sort().at(-1) || null;
}

function validateChartSeries(local, remote) {
  const remoteMetrics = Object.keys(remote.metrics || {}).sort();
  const remoteSeries = Object.keys(remote.series || {}).sort();
  const remoteOrder = [...(remote.metricOrder || [])].sort();
  contract(JSON.stringify(remoteMetrics) === JSON.stringify(remoteSeries), "chart metric and series keys differ");
  contract(JSON.stringify(remoteMetrics) === JSON.stringify(remoteOrder), "chart metric order keys differ");
  superset(remoteMetrics, Object.keys(local.metrics || {}), "chart metrics");
  for (const [id, rows] of Object.entries(remote.series || {})) {
    contract(rows.length > 0, `chart ${id} is empty`);
    sortedUnique(rows, (item) => item.t, `chart ${id}`);
    const localEnd = latestKey(local.series?.[id], (item) => item.t);
    const remoteEnd = latestKey(rows, (item) => item.t);
    if (localEnd) contract(remoteEnd >= localEnd, `chart ${id} regressed its end date`);
  }
}

function validateEquityFast(local, remote) {
  const localMetrics = new Map((local.metrics || []).map((item) => [item.id, item]));
  const remoteMetrics = new Map((remote.metrics || []).map((item) => [item.id, item]));
  superset([...remoteMetrics.keys()], [...localMetrics.keys()], "equity-fast metrics");
  for (const [id, localMetric] of localMetrics) {
    const remoteMetric = remoteMetrics.get(id);
    if (finiteNumber(localMetric.value) != null) {
      contract(finiteNumber(remoteMetric?.value) != null, `equity-fast ${id} replaced a value with null`);
    }
    if (timestamp(localMetric.asOf) != null) {
      contract(timestamp(remoteMetric?.asOf) >= timestamp(localMetric.asOf), `equity-fast ${id} regressed asOf`);
    }
  }
}

function validateMarketMonthly(local, remote) {
  const localAssets = local.assets || {};
  const remoteAssets = remote.assets || {};
  superset(Object.keys(remoteAssets), Object.keys(localAssets), "market-monthly assets");
  for (const [symbol, localAsset] of Object.entries(localAssets)) {
    const remoteAsset = remoteAssets[symbol];
    sortedUnique(remoteAsset?.rows || [], (item) => item.monthKey, `market-monthly ${symbol}`);
    contract((remoteAsset?.rows || []).length >= (localAsset?.rows || []).length, `market-monthly ${symbol} lost rows`);
    const localEnd = latestKey(localAsset?.rows, (item) => item.monthKey);
    const remoteEnd = latestKey(remoteAsset?.rows, (item) => item.monthKey);
    if (localEnd) contract(remoteEnd >= localEnd, `market-monthly ${symbol} regressed its last month`);
    if (timestamp(localAsset?.updatedAt) != null) {
      contract(timestamp(remoteAsset?.updatedAt) >= timestamp(localAsset.updatedAt), `market-monthly ${symbol} regressed updatedAt`);
    }
  }
}

function validateEquityWeekly(local, remote) {
  sortedUnique(remote.days || [], (item) => item.date, "equity-weekly days");
  contract((remote.days || []).length >= (local.days || []).length, "equity-weekly lost days");
  const localEnd = latestKey(local.days, (item) => item.date);
  const remoteEnd = latestKey(remote.days, (item) => item.date);
  if (localEnd) contract(remoteEnd >= localEnd, "equity-weekly regressed its last date");
  superset(Object.keys(remote.assets || {}), Object.keys(local.assets || {}), "equity-weekly assets");
}

function macroEventKey(item) {
  return [item?.date, item?.seriesId, item?.role, item?.country, item?.holiday, item?.source, item?.label].join("|");
}

function validateMacroCalendar(local, remote) {
  const keys = (remote.events || []).map(macroEventKey);
  contract(new Set(keys).size === keys.length, "macro calendar contains duplicate events");
  contract((remote.events || []).length >= (local.events || []).length, "macro calendar lost events");
  const localEnd = latestKey(local.events, (item) => item.date);
  const remoteEnd = latestKey(remote.events, (item) => item.date);
  if (localEnd) contract(remoteEnd >= localEnd, "macro calendar regressed its last event date");
}

function pricePathEntries(asset) {
  return Array.isArray(asset?.pricePaths)
    ? [["default", asset.pricePaths]]
    : Object.entries(asset?.pricePaths || {});
}

function validateWatchlist(local, remote, label) {
  const localAssets = local.assets || {};
  const remoteAssets = remote.assets || {};
  superset(Object.keys(remoteAssets), Object.keys(localAssets), `${label} assets`);
  for (const [symbol, remoteAsset] of Object.entries(remoteAssets)) {
    const localPaths = new Map(pricePathEntries(localAssets[symbol]));
    const remotePaths = new Map(pricePathEntries(remoteAsset));
    superset([...remotePaths.keys()], [...localPaths.keys()], `${label} ${symbol} price-path ranges`);
    for (const [range, rows] of remotePaths) {
      sortedUnique(rows, (item) => item.t, `${label} ${symbol} ${range}`);
      const localRows = localPaths.get(range) || [];
      const localEnd = latestKey(localRows, (item) => item.t);
      const remoteEnd = latestKey(rows, (item) => item.t);
      if (localEnd) contract(remoteEnd >= localEnd, `${label} ${symbol} ${range} regressed its end time`);
    }
  }
}

export function validatePassthroughSnapshot(file, local, remote) {
  contract(local && remote, `${file} snapshots are required`);
  switch (file) {
    case "chart-series.json": validateChartSeries(local, remote); break;
    case "chip-chain-hotspots.json": validateWatchlist(local, remote, "chip-chain"); break;
    case "equity-fast.json": validateEquityFast(local, remote); break;
    case "equity-weekly.json": validateEquityWeekly(local, remote); break;
    case "macro-calendar.json": validateMacroCalendar(local, remote); break;
    case "market-monthly.json": validateMarketMonthly(local, remote); break;
    case "robot-chain-watchlist.json": validateWatchlist(local, remote, "robot-chain"); break;
    default: throw new Error(`No passthrough validator for ${file}`);
  }
  return true;
}

export function validateCryptoMergeResult(local, remote, merged) {
  contract(merged?.version === local?.version, "crypto schema version changed");
  const mergedMetrics = new Map((merged?.metrics || []).map((item) => [item.id, item]));
  for (const metric of local?.metrics || []) {
    if (finiteNumber(metric.value) != null) {
      contract(finiteNumber(mergedMetrics.get(metric.id)?.value) != null, `crypto metric ${metric.id} lost its value`);
    }
  }
  for (const [metricId, localRows] of Object.entries(local?.history || {})) {
    const rows = merged?.history?.[metricId] || [];
    sortedUnique(rows, (item) => item.date, `crypto history ${metricId}`);
    contract(rows.length >= Math.min(localRows.length, 400), `crypto history ${metricId} lost coverage`);
    const localEnd = latestKey(localRows, (item) => item.date);
    const mergedEnd = latestKey(rows, (item) => item.date);
    if (localEnd) contract(mergedEnd >= localEnd, `crypto history ${metricId} regressed its end date`);
  }
  for (const [asset, localSeries] of Object.entries(local?.etf || {})) {
    const rows = merged?.etf?.[asset]?.daily || [];
    sortedUnique(rows, (item) => item.date, `crypto ETF ${asset}`);
    contract(rows.length >= Math.min((localSeries?.daily || []).length, 400), `crypto ETF ${asset} lost coverage`);
    const localEnd = latestKey(localSeries?.daily, (item) => item.date);
    const mergedEnd = latestKey(rows, (item) => item.date);
    if (localEnd) contract(mergedEnd >= localEnd, `crypto ETF ${asset} regressed its end date`);
  }
  for (const [ticker, treasury] of Object.entries(local?.corporateTreasuries || {})) {
    contract(merged?.corporateTreasuries?.[ticker]?.holdings === treasury.holdings, `${ticker} primary holdings changed`);
  }
  for (const [asset, localSpot] of Object.entries(local?.spotPrices || {})) {
    const remoteSpot = remote?.spotPrices?.[asset];
    const localRevision = { ...localSpot, fetchedAt: localSpot?.fetchedAt || local?.timestamps?.fetchedAt || null };
    const remoteRevision = { ...remoteSpot, fetchedAt: remoteSpot?.fetchedAt || remote?.timestamps?.fetchedAt || null };
    const validity = compareValidity(remoteSpot?.priceUsd, localSpot?.priceUsd);
    const expected = validity > 0 || (validity === 0 && compareRevision(remoteRevision, localRevision) > 0)
      ? remoteSpot
      : localSpot;
    if (finiteNumber(expected?.priceUsd) != null) {
      contract(merged?.spotPrices?.[asset]?.priceUsd === expected.priceUsd, `${asset} spot revision selection failed`);
    }
  }
  return true;
}

export function validateMarketSessionMergeResult(local, remote, merged) {
  contract(JSON.stringify(merged?.markets) === JSON.stringify(local?.markets), "market calendars changed during quote merge");
  const mergedAssets = new Map((merged?.assets || []).map((item) => [item.symbol, item]));
  const symbols = (merged?.assets || []).map((item) => item.symbol);
  contract(new Set(symbols).size === symbols.length, "market-session contains duplicate symbols");
  for (const localAsset of local?.assets || []) {
    const mergedAsset = mergedAssets.get(localAsset.symbol);
    contract(mergedAsset, `market-session dropped ${localAsset.symbol}`);
    if (localAsset.sessionEligibility) {
      contract(mergedAsset.sessionEligibility === localAsset.sessionEligibility, `${localAsset.symbol} lost session eligibility`);
    }
    const remoteAsset = (remote?.assets || []).find((item) => item.symbol === localAsset.symbol);
    const localRevision = {
      source: localAsset.sourceKind,
      observedAt: localAsset.asOf,
      fetchedAt: localAsset.fetchedAt || local?.timestamps?.fetchedAt || null,
    };
    const remoteRevision = {
      source: remoteAsset?.sourceKind,
      observedAt: remoteAsset?.asOf,
      fetchedAt: remoteAsset?.fetchedAt || remote?.timestamps?.fetchedAt || null,
    };
    const validity = compareValidity(remoteAsset?.price, localAsset.price);
    if (
      timestamp(remoteAsset?.asOf) != null
      && (validity > 0 || (validity === 0 && compareRevision(remoteRevision, localRevision) > 0))
    ) {
      contract(mergedAsset.asOf === remoteAsset.asOf && mergedAsset.price === remoteAsset.price, `${localAsset.symbol} did not take the newer quote`);
    } else if (finiteNumber(localAsset.price) != null) {
      contract(mergedAsset.price === localAsset.price, `${localAsset.symbol} lost its valid quote`);
    }
  }
  return true;
}

export function selectFreshSnapshot(local, remote) {
  if (!local || !remote) throw new Error("Both snapshots are required");
  const localFreshness = snapshotFreshness(local);
  const remoteFreshness = snapshotFreshness(remote);
  if (isNewer(remoteFreshness, localFreshness)) {
    return { snapshot: remote, selected: "remote", localFreshness, remoteFreshness };
  }
  return { snapshot: local, selected: "local", localFreshness, remoteFreshness };
}
