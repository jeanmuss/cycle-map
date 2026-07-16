import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  attachHistoricalMetricFallbacks,
  attachMetricChanges,
  attachTreasurySpotPrice,
  combineDefiLlamaStablecoinHistory,
  CRYPTO_LIQUIDITY_MINIMUM_BACKFILL_DAYS,
  CRYPTO_LIQUIDITY_VERSION,
  finiteNumber,
  hasFreshCmcStablecoinBackfill,
  mergeSosoEtfHistory,
  mergeHistoricalMetricSeries,
  mergeMetricHistory,
  mergeTreasurySnapshots,
  normalizeBlockbeatsBtcHistory,
  normalizeCmcHistoricalLiquidity,
  normalizeCmcLiquidity,
  normalizeCmcSpotPrices,
  normalizeDefiLlamaStablecoinHistory,
  normalizeReviewedTreasuryDisclosure,
  normalizeSosoEtfHistory,
  normalizeStrategyTreasuryHistory,
  planCmcHistoryFetch,
  requireCmcLiquiditySnapshot,
  requireSosoEtfHistory,
  shouldRefreshCmcHistory,
  summarizeMetricHistory,
} from "./crypto-liquidity-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(appRoot, "..");
const outputPath = resolve(appRoot, "public", "data", "crypto-liquidity.json");
const treasuryDisclosuresPath = resolve(appRoot, "data", "corporate-treasury-disclosures.json");
const equityFastPath = resolve(appRoot, "public", "data", "equity-fast.json");
const marketSessionPath = resolve(appRoot, "public", "data", "market-session.json");
const CMC_GLOBAL_URL = "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest?convert=USD";
const CMC_QUOTES_URL = "https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest?id=1,1027,825,3408&convert=USD";
const CMC_GLOBAL_HISTORY_URL = "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/historical";
const CMC_ASSET_HISTORY_URL = "https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/historical";
const DEFILLAMA_STABLECOIN_BASE_URL = "https://stablecoins.llama.fi";
const SOSO_BASE_URL = "https://openapi.sosovalue.com/openapi/v1";
const SOSO_ETF_URL = `${SOSO_BASE_URL}/etfs/summary-history`;
const SOSO_STRATEGY_URL = `${SOSO_BASE_URL}/btc-treasuries/MSTR/purchase-history?limit=100`;
const BLOCKBEATS_URL = "https://api-pro.theblockbeats.info/v1/data/btc_etf";
const BITMINE_CIK = "0001829311";
const SEC_SUBMISSIONS_URL = `https://data.sec.gov/submissions/CIK${BITMINE_CIK}.json`;

function isoNow() {
  return new Date().toISOString();
}

async function loadEnvFile(path) {
  let textValue;
  try {
    textValue = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const line of textValue.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function safeFailure(error) {
  let text = String(error?.message || error || "unknown error");
  for (const value of [process.env.CMC_PRO_API_KEY, process.env.SOSOVALUE_API_KEY, process.env.BLOCKBEATS_API_KEY, process.env.SEC_USER_AGENT]) {
    if (value) text = text.replaceAll(value, "<redacted>");
  }
  return text.slice(0, 500);
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "cycle-map-crypto-liquidity/1.0",
        ...options.headers,
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "cycle-map-market-data/1.0",
        ...options.headers,
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCmcMetrics() {
  const key = process.env.CMC_PRO_API_KEY;
  if (!key) throw new Error("CMC_PRO_API_KEY is not configured");
  const headers = { "X-CMC_PRO_API_KEY": key };
  const [globalPayload, quotesPayload] = await Promise.all([
    fetchJson(CMC_GLOBAL_URL, { headers }),
    fetchJson(CMC_QUOTES_URL, { headers }),
  ]);
  const result = requireCmcLiquiditySnapshot(
    normalizeCmcLiquidity(globalPayload, quotesPayload),
    normalizeCmcSpotPrices(quotesPayload),
  );
  const fetchedAt = isoNow();
  return {
    metrics: result.metrics.map((item) => ({ ...item, fetchedAt })),
    spotPrices: Object.fromEntries(Object.entries(result.spotPrices).map(([asset, item]) => [asset, { ...item, fetchedAt }])),
  };
}

function cmcHistoryQuery(plan, parameters = {}) {
  return new URLSearchParams({
    time_start: plan.timeStart,
    time_end: plan.timeEnd,
    interval: "daily",
    convert: "USD",
    ...parameters,
  });
}

async function fetchCmcGlobalHistory(existingHistory, now) {
  const key = process.env.CMC_PRO_API_KEY;
  if (!key) throw new Error("CMC_PRO_API_KEY is not configured");
  const plan = planCmcHistoryFetch(existingHistory?.["crypto.totalMarketCap"], now);
  const payload = await fetchJson(`${CMC_GLOBAL_HISTORY_URL}?${cmcHistoryQuery(plan, { aux: "search_interval" })}`, {
    headers: { "X-CMC_PRO_API_KEY": key },
  });
  const history = normalizeCmcHistoricalLiquidity(payload, null, isoNow());
  const points = history["crypto.totalMarketCap"] || [];
  if (!points.length) throw new Error("CMC global historical response contained no total-market-cap observations");
  return { history, plan, points: points.length, fetchedAt: payload?.status?.timestamp || isoNow() };
}

async function fetchCmcAssetHistory(existingHistory, now) {
  const key = process.env.CMC_PRO_API_KEY;
  if (!key) throw new Error("CMC_PRO_API_KEY is not configured");
  const plan = planCmcHistoryFetch(existingHistory?.["btc.marketCap"], now);
  const query = cmcHistoryQuery(plan, {
    id: "1,825,3408",
    aux: "price,market_cap,quote_timestamp,search_interval",
    skip_invalid: "false",
  });
  const payload = await fetchJson(`${CMC_ASSET_HISTORY_URL}?${query}`, {
    headers: { "X-CMC_PRO_API_KEY": key },
  });
  const history = normalizeCmcHistoricalLiquidity(null, payload, isoNow());
  const required = ["btc.marketCap", "stablecoin.usdt.marketCap", "stablecoin.usdc.marketCap"];
  const missing = required.filter((metricId) => !(history[metricId] || []).length);
  if (missing.length === required.length) throw new Error("CMC asset historical response contained no requested market-cap observations");
  return {
    history,
    plan,
    points: Object.fromEntries(required.map((metricId) => [metricId, history[metricId]?.length || 0])),
    missing,
    fetchedAt: payload?.status?.timestamp || isoNow(),
  };
}

async function fetchDefiLlamaStablecoinHistory() {
  const catalog = await fetchJson(`${DEFILLAMA_STABLECOIN_BASE_URL}/stablecoins?includePrices=false`);
  const assets = Array.isArray(catalog?.peggedAssets) ? catalog.peggedAssets : [];
  const selected = Object.fromEntries(["USDT", "USDC"].map((symbol) => {
    const matches = assets.filter((item) => String(item?.symbol || "").toUpperCase() === symbol && item?.pegType === "peggedUSD");
    if (matches.length !== 1 || !matches[0]?.id) {
      throw new Error(`DefiLlama stablecoin catalog did not resolve exactly one peggedUSD ${symbol} asset`);
    }
    return [symbol, matches[0]];
  }));
  const payloads = await Promise.all(["USDT", "USDC"].map(async (symbol) => {
    const payload = await fetchJson(`${DEFILLAMA_STABLECOIN_BASE_URL}/stablecoin/${encodeURIComponent(String(selected[symbol].id))}`);
    return [symbol, payload];
  }));
  const fetchedAt = isoNow();
  const normalized = payloads.map(([symbol, payload]) => normalizeDefiLlamaStablecoinHistory(payload, symbol, fetchedAt));
  const history = combineDefiLlamaStablecoinHistory(normalized, fetchedAt);
  return {
    history,
    fetchedAt,
    points: Object.fromEntries(Object.entries(history).map(([metricId, points]) => [metricId, points.length])),
    providerAssetIds: Object.fromEntries(Object.entries(selected).map(([symbol, item]) => [symbol, String(item.id)])),
  };
}

function unwrapSosoPayload(payload, label) {
  if (Array.isArray(payload)) return payload;
  if (Number(payload?.code) !== 0) throw new Error(`SoSoValue ${label} request failed`);
  if (!Array.isArray(payload?.data)) throw new Error(`SoSoValue ${label} returned an invalid data envelope`);
  return payload.data;
}

async function fetchSosoAsset(asset) {
  const key = process.env.SOSOVALUE_API_KEY;
  if (!key) throw new Error("SOSOVALUE_API_KEY is not configured");
  const query = new URLSearchParams({ symbol: asset, country_code: "US", limit: "300" });
  const payload = await fetchJson(`${SOSO_ETF_URL}?${query}`, {
    headers: { "x-soso-api-key": key },
  });
  const fetchedAt = isoNow();
  const result = requireSosoEtfHistory(normalizeSosoEtfHistory(unwrapSosoPayload(payload, `${asset} ETF`), asset), asset);
  return {
    ...result,
    fetchedAt,
    lastCheckedAt: fetchedAt,
    daily: result.daily.map((point) => ({ ...point, fetchedAt, lastCheckedAt: fetchedAt })),
  };
}

async function fetchStrategyTreasury() {
  const key = process.env.SOSOVALUE_API_KEY;
  if (!key) throw new Error("SOSOVALUE_API_KEY is not configured");
  const payload = await fetchJson(SOSO_STRATEGY_URL, {
    headers: { "x-soso-api-key": key },
  });
  const result = normalizeStrategyTreasuryHistory(unwrapSosoPayload(payload, "MSTR treasury"));
  if (!result.history.length) throw new Error("SoSoValue MSTR treasury returned an empty history");
  return result;
}

function plainText(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#36;/gi, "$")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTH_INDEX = Object.fromEntries(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, index) => [month, index]));

function nthSunday(year, monthIndex, ordinal) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  return 1 + ((7 - first.getUTCDay()) % 7) + (ordinal - 1) * 7;
}

function easternDisclosureTimestamp(dateText, timeText, meridiem) {
  const match = String(dateText).match(/^([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match || MONTH_INDEX[match[1]] == null) return null;
  const year = Number(match[3]);
  const month = MONTH_INDEX[match[1]];
  const day = Number(match[2]);
  let hour = 12;
  let minute = 0;
  const timeMatch = String(timeText || "").match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    hour = Number(timeMatch[1]) % 12;
    if (String(meridiem).toLowerCase() === "pm") hour += 12;
    minute = Number(timeMatch[2]);
  }
  const dstStart = { month: 2, day: nthSunday(year, 2, 2) };
  const dstEnd = { month: 10, day: nthSunday(year, 10, 1) };
  const afterStart = month > dstStart.month || (month === dstStart.month && day >= dstStart.day);
  const beforeEnd = month < dstEnd.month || (month === dstEnd.month && day < dstEnd.day);
  const offsetHours = afterStart && beforeEnd ? 4 : 5;
  return new Date(Date.UTC(year, month, day, hour + offsetHours, minute)).toISOString();
}

function parseBitmineHoldingsDisclosure(html, filingDate, sourceUrl) {
  const text = plainText(html);
  const match = text.match(/As of\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})(?:\s+at\s+(\d{1,2}:\d{2})(am|pm)\s+ET)?.{0,350}?holdings are comprised of\s+([\d,]+)\s+ETH/i);
  if (!match) return null;
  const holdings = finiteNumber(match[4].replaceAll(",", ""));
  const holdingsObservedAt = easternDisclosureTimestamp(match[1], match[2], match[3]);
  if (holdings == null || !holdingsObservedAt) return null;
  return {
    disclosedAt: filingDate,
    holdingsObservedAt,
    holdings,
    sourceUrl,
    qualityStatus: "official_sec_exhibit_automated",
  };
}

async function fetchBitmineSecHoldings() {
  const userAgent = String(process.env.SEC_USER_AGENT || "").trim();
  if (!userAgent) return { status: "reserved_missing_user_agent", holdings: [] };
  const submissions = await fetchJson(SEC_SUBMISSIONS_URL, { headers: { "User-Agent": userAgent } });
  const recent = submissions?.filings?.recent || {};
  const filings = (recent.form || []).map((form, index) => ({
    form,
    accession: recent.accessionNumber?.[index],
    filingDate: recent.filingDate?.[index],
  })).filter((filing) => filing.form === "8-K" && filing.accession && filing.filingDate).slice(0, 12);
  const holdings = [];
  for (const filing of filings) {
    const accession = filing.accession.replaceAll("-", "");
    const sourceUrl = `https://www.sec.gov/Archives/edgar/data/1829311/${accession}/ex99-1.htm`;
    try {
      const html = await fetchText(sourceUrl, { headers: { "User-Agent": userAgent } });
      const disclosure = parseBitmineHoldingsDisclosure(html, filing.filingDate, sourceUrl);
      if (disclosure) holdings.push(disclosure);
      if (holdings.length >= 4) break;
    } catch {
      // Many 8-Ks do not include an EX-99.1 treasury update; continue to the next filing.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
  return { status: holdings.length ? "available" : "no_matching_disclosure", holdings };
}

async function fetchBlockbeatsAuxiliary() {
  const enabled = process.env.BLOCKBEATS_AUX_ENABLED === "1";
  const key = process.env.BLOCKBEATS_API_KEY;
  if (!enabled || !key) {
    return {
      enabled,
      configured: Boolean(key),
      status: enabled ? "reserved_missing_key" : "reserved_disabled",
      role: "auxiliary_cross_check_only",
      endpoint: "/v1/data/btc_etf",
      data: null,
    };
  }
  const payload = await fetchJson(BLOCKBEATS_URL, { headers: { "api-key": key } });
  return {
    enabled: true,
    configured: true,
    status: "available",
    role: "auxiliary_cross_check_only",
    endpoint: "/v1/data/btc_etf",
    data: normalizeBlockbeatsBtcHistory(payload),
  };
}

function localFallbackMetrics(equityFast, marketSession) {
  const fast = Object.fromEntries((equityFast?.metrics || []).map((item) => [item.id, item]));
  const assets = Object.fromEntries((marketSession?.assets || []).map((item) => [item.symbol, item]));
  const total = fast.CRYPTO_MARKET_CAP;
  const btc = fast.BTC_MARKET_CAP || assets.BTC;
  const usdt = assets.USDT;
  return [
    {
      id: "crypto.totalMarketCap", label: "Total crypto market cap", labelZh: "加密市场总市值",
      value: finiteNumber(total?.value), unit: "USD", observedAt: total?.asOf || null, source: "existing-static-cache",
      changePct24h: finiteNumber(total?.changePct), semantics: "market_cap_change_not_net_flow",
    },
    {
      id: "btc.marketCap", label: "Bitcoin market cap", labelZh: "BTC 总市值",
      value: finiteNumber(btc?.value ?? btc?.marketCapUsd), unit: "USD", observedAt: btc?.asOf || btc?.marketCapAsOf || null, source: "existing-static-cache",
      changePct24h: finiteNumber(btc?.changePct), semantics: "market_cap_change_not_net_flow",
    },
    {
      id: "stablecoin.usdt.marketCap", label: "USDT circulating market cap", labelZh: "USDT 流通市值",
      value: finiteNumber(usdt?.marketCapUsd), unit: "USD", observedAt: usdt?.marketCapAsOf || usdt?.asOf || null, source: "existing-static-cache",
      changePct24h: null, semantics: "circulating_supply_proxy",
    },
    {
      id: "stablecoin.usdc.marketCap", label: "USDC circulating market cap", labelZh: "USDC 流通市值",
      value: null, unit: "USD", observedAt: null, source: "pending-cmc-refresh", changePct24h: null,
      semantics: "circulating_supply_proxy",
    },
    {
      id: "stablecoin.major.marketCap", label: "USDT + USDC market cap", labelZh: "主流稳定币市值",
      value: null, unit: "USD", observedAt: null, source: "pending-cmc-refresh", coverage: ["USDT", "USDC"],
      semantics: "tracked_stablecoin_supply_not_total_market",
    },
    {
      id: "stablecoin.usdt.depegBps", label: "USDT peg deviation", labelZh: "USDT 脱锚幅度",
      value: finiteNumber(usdt?.price) == null ? null : (finiteNumber(usdt.price) - 1) * 10_000,
      unit: "bps", observedAt: usdt?.asOf || null, source: "existing-static-cache", price: finiteNumber(usdt?.price),
      semantics: "price_deviation_not_flow",
    },
  ];
}

function oldest(values) {
  return values.filter(Boolean).sort()[0] || null;
}

async function writeJsonAtomic(path, payload) {
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}

if (process.env.CYCLE_MAP_SKIP_LOCAL_ENV !== "1") {
  await loadEnvFile(resolve(appRoot, ".env.local"));
  await loadEnvFile(resolve(workspaceRoot, ".env.local"));
}

const existing = await readJson(outputPath, null);
const failures = [];
let freshSourceCount = 0;
let metrics = null;
let spotPrices = existing?.spotPrices || null;
try {
  const cmc = await fetchCmcMetrics();
  metrics = cmc.metrics;
  spotPrices = cmc.spotPrices;
  freshSourceCount += 1;
} catch (error) {
  failures.push(`CMC: ${safeFailure(error)}`);
}

if (!metrics) {
  if (existing?.metrics?.length) metrics = existing.metrics.map(({ change1d, change7d, ...item }) => item);
  else metrics = localFallbackMetrics(await readJson(equityFastPath, {}), await readJson(marketSessionPath, {}));
}

let freshMetricHistory = {};
let historyRefresh = existing?.historyRefresh || null;
const historyNow = new Date();
const publicHistoryDisabled = process.env.CYCLE_MAP_DISABLE_PUBLIC_HISTORY === "1";
const historyRefreshForced = process.env.CYCLE_MAP_FORCE_HISTORY_REFRESH === "1" || process.argv.includes("--force-history");
if (!publicHistoryDisabled && (historyRefreshForced || shouldRefreshCmcHistory(historyRefresh, historyNow))) {
  const attemptedAt = isoNow();
  const providerStatus = {};
  let historyProviderSuccess = false;
  const [globalResult, assetResult] = await Promise.allSettled([
    fetchCmcGlobalHistory(existing?.history || {}, historyNow),
    fetchCmcAssetHistory(existing?.history || {}, historyNow),
  ]);
  if (globalResult.status === "fulfilled") {
    freshMetricHistory = mergeHistoricalMetricSeries(freshMetricHistory, globalResult.value.history);
    providerStatus.cmcGlobal = {
      status: "available",
      fetchedAt: globalResult.value.fetchedAt,
      points: globalResult.value.points,
      window: globalResult.value.plan,
    };
    freshSourceCount += 1;
    historyProviderSuccess = true;
  } else {
    failures.push(`CMC global history: ${safeFailure(globalResult.reason)}`);
    providerStatus.cmcGlobal = { status: "failed_preserved_last_known_good", attemptedAt };
  }
  if (assetResult.status === "fulfilled") {
    freshMetricHistory = mergeHistoricalMetricSeries(freshMetricHistory, assetResult.value.history);
    providerStatus.cmcAssets = {
      status: assetResult.value.missing.length ? "partial" : "available",
      fetchedAt: assetResult.value.fetchedAt,
      points: assetResult.value.points,
      missing: assetResult.value.missing,
      window: assetResult.value.plan,
    };
    if (assetResult.value.missing.length) {
      failures.push(`CMC asset history omitted: ${assetResult.value.missing.join(", ")}`);
    }
    freshSourceCount += 1;
    historyProviderSuccess = true;
  } else {
    failures.push(`CMC asset history: ${safeFailure(assetResult.reason)}`);
    providerStatus.cmcAssets = { status: "failed_preserved_last_known_good", attemptedAt };
  }

  const candidateHistory = mergeHistoricalMetricSeries(existing?.history, freshMetricHistory);
  const stablecoinHasCmcBackfill = hasFreshCmcStablecoinBackfill(candidateHistory, historyNow);
  if (!stablecoinHasCmcBackfill) {
    try {
      const defillama = await fetchDefiLlamaStablecoinHistory();
      freshMetricHistory = mergeHistoricalMetricSeries(freshMetricHistory, defillama.history);
      providerStatus.defillamaStablecoins = {
        status: "available",
        fetchedAt: defillama.fetchedAt,
        points: defillama.points,
        providerAssetIds: defillama.providerAssetIds,
      };
      freshSourceCount += 1;
      historyProviderSuccess = true;
    } catch (error) {
      failures.push(`DefiLlama stablecoin history: ${safeFailure(error)}`);
      providerStatus.defillamaStablecoins = { status: "failed_preserved_last_known_good", attemptedAt };
    }
  } else {
    providerStatus.defillamaStablecoins = { status: "not_needed_cmc_history_available", attemptedAt };
  }
  historyRefresh = {
    lastAttemptedAt: attemptedAt,
    lastSuccessfulAt: historyProviderSuccess ? attemptedAt : historyRefresh?.lastSuccessfulAt || null,
    initialBackfillDays: 365,
    minimumBackfillDays: CRYPTO_LIQUIDITY_MINIMUM_BACKFILL_DAYS,
    overlapDays: 14,
    refreshCadenceHours: 20,
    providers: providerStatus,
  };
}

if (!spotPrices) {
  const marketSession = await readJson(marketSessionPath, {});
  const assets = Object.fromEntries((marketSession?.assets || []).map((item) => [item.symbol, item]));
  spotPrices = Object.fromEntries(["BTC", "ETH"].map((asset) => [asset, {
    asset,
    priceUsd: finiteNumber(assets[asset]?.price),
    observedAt: assets[asset]?.asOf || null,
    source: "existing-static-cache",
  }]));
}

const etf = { ...(existing?.etf || {}) };
for (const asset of ["BTC", "ETH", "SOL"]) {
  try {
    etf[asset] = mergeSosoEtfHistory(etf[asset], await fetchSosoAsset(asset));
    freshSourceCount += 1;
  } catch (error) {
    failures.push(`SoSoValue ${asset}: ${safeFailure(error)}`);
    etf[asset] ||= {
      asset,
      cadence: "daily",
      status: "pending_credentials",
      source: "sosovalue",
      observedAt: null,
      daily: [],
      weekly: [],
    };
  }
}

const reviewedDisclosures = await readJson(treasuryDisclosuresPath, { treasuries: {} });
const reviewedStrategy = normalizeReviewedTreasuryDisclosure(reviewedDisclosures?.treasuries?.MSTR || {});
let bitmineSec = { status: "reserved_missing_user_agent", holdings: [] };
try {
  bitmineSec = await fetchBitmineSecHoldings();
  if (bitmineSec.holdings.length) freshSourceCount += 1;
} catch (error) {
  failures.push(`BitMine SEC holdings: ${safeFailure(error)}`);
  bitmineSec = { status: "failed_preserved_reviewed_disclosures", holdings: [] };
}
const bitmineDisclosurePayload = reviewedDisclosures?.treasuries?.BMNR || {};
const reviewedBitmine = normalizeReviewedTreasuryDisclosure({
  ...bitmineDisclosurePayload,
  holdings: [...(bitmineDisclosurePayload.holdings || []), ...bitmineSec.holdings],
});
let strategyPrimary = existing?.corporateTreasuries?.MSTR || null;
try {
  strategyPrimary = await fetchStrategyTreasury();
  freshSourceCount += 1;
} catch (error) {
  failures.push(`SoSoValue MSTR treasury: ${safeFailure(error)}`);
}
const corporateTreasuries = {
  MSTR: attachTreasurySpotPrice(mergeTreasurySnapshots(strategyPrimary, reviewedStrategy), spotPrices?.BTC),
  BMNR: attachTreasurySpotPrice(mergeTreasurySnapshots(existing?.corporateTreasuries?.BMNR, reviewedBitmine), spotPrices?.ETH),
};

let blockbeats;
try {
  blockbeats = await fetchBlockbeatsAuxiliary();
  if (blockbeats.status === "available") freshSourceCount += 1;
} catch (error) {
  failures.push(`BlockBeats auxiliary: ${safeFailure(error)}`);
  blockbeats = {
    enabled: true,
    configured: true,
    status: "failed_preserved_primary",
    role: "auxiliary_cross_check_only",
    endpoint: "/v1/data/btc_etf",
    data: existing?.auxiliarySources?.blockbeats?.data || null,
  };
}

if (existing && freshSourceCount === 0) {
  console.log("Crypto liquidity update skipped: no primary or auxiliary source refreshed; preserving last-known-good JSON.");
  process.exit(0);
}

const transformedAt = isoNow();
let history = mergeMetricHistory(existing?.history, metrics);
history = mergeHistoricalMetricSeries(history, freshMetricHistory);
metrics = attachHistoricalMetricFallbacks(metrics, history);
metrics = attachMetricChanges(metrics, history);
const historyCoverage = summarizeMetricHistory(history);
const levelsObservedAt = oldest(metrics.filter((item) => item.value != null).map((item) => item.observedAt));
const etfObservedAt = oldest(Object.values(etf).filter((item) => item.status === "available").map((item) => item.observedAt));
const treasuryObservedAt = oldest(Object.values(corporateTreasuries).filter((item) => item.status === "available").map((item) => item.holdingsObservedAt));
const observedAt = oldest([levelsObservedAt, etfObservedAt]);

const output = {
  version: CRYPTO_LIQUIDITY_VERSION,
  page: "crypto-liquidity",
  generatedAt: transformedAt,
  timestamps: {
    observedAt,
    fetchedAt: freshSourceCount ? transformedAt : oldest(metrics.map((item) => item.observedAt)),
    transformedAt,
  },
  sectionObservedAt: {
    levels: levelsObservedAt,
    etf: etfObservedAt,
    corporateTreasuries: treasuryObservedAt,
  },
  status: failures.length ? "partial" : "available",
  metrics,
  history,
  historyCoverage,
  historyRefresh,
  etf,
  spotPrices,
  corporateTreasuries,
  corporateTreasuryAutomation: {
    strategy: "sosovalue_plus_official_8k_cost",
    bitmine: bitmineSec.status,
  },
  auxiliarySources: { blockbeats },
  methodology: {
    marketCaps: "Market-cap changes are valuation changes, not capital inflows. CoinMarketCap supplies current aggregate and asset market caps. Its documented historical endpoints are backfilled once and then refreshed with a short overlap; plan-denied asset history remains explicitly unavailable.",
    stablecoins: "USDT and USDC market caps proxy circulating supply in USD. Their sum is labelled as tracked major stablecoins, not the entire stablecoin market. When CoinMarketCap asset history is unavailable, DefiLlama's documented free Stablecoins API supplies same-source circulating-USD history. A fresh CoinMarketCap current level is retained; a missing or stale stablecoin current level may advance to the newest documented same-series history point.",
    usdtPeg: "USDT peg deviation is (price - 1 USD) × 10,000 basis points and is not a flow metric.",
    etf: "SoSoValue v1 daily aggregate net flow is used for U.S. BTC, ETH, and SOL spot ETF series. Its one-month response is merged with prior observations; missing trading days are never filled with zero.",
    treasury: "Corporate treasury holdings and acquisition-cost observations keep separate source dates. Strategy average cost uses its official Form 8-K; BitMine cost basis per ETH is derived only from same-date SEC units and cost basis. Press-release spot prices are never treated as acquisition cost.",
    blockbeats: "BlockBeats is reserved as an auxiliary BTC cross-check only and never overwrites the primary ETF series.",
  },
  sources: {
    cmc: "https://coinmarketcap.com/api/documentation/pro-api-reference/",
    cmcGlobalHistory: "https://coinmarketcap.com/api/documentation/pro-api-reference/global-metrics",
    cmcAssetHistory: "https://coinmarketcap.com/api/documentation/pro-api-reference/cryptocurrency",
    defillamaStablecoins: "https://api-docs.defillama.com/",
    sosovalueEtf: "https://sosovalue-1.gitbook.io/sosovalue-api-doc/2.-etf/summary-history",
    sosovalueTreasury: "https://sosovalue-1.gitbook.io/sosovalue-api-doc/5.-btc-treasuries/purchase-history",
    strategy: corporateTreasuries.MSTR.sourceUrl,
    bitmine: corporateTreasuries.BMNR.sourceUrl,
    secSubmissions: SEC_SUBMISSIONS_URL,
    blockbeats: "https://www.theblockbeats.info/apiDoc",
  },
  failures,
};

await writeJsonAtomic(outputPath, output);
console.log(JSON.stringify({ status: output.status, metrics: metrics.length, etfAssets: Object.keys(etf), failures: failures.length }));
