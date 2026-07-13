import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  attachMetricChanges,
  CRYPTO_LIQUIDITY_VERSION,
  finiteNumber,
  mergeMetricHistory,
  normalizeBlockbeatsBtcHistory,
  normalizeCmcLiquidity,
  normalizeSosoEtfHistory,
  requireSosoEtfHistory,
} from "./crypto-liquidity-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(appRoot, "..");
const outputPath = resolve(appRoot, "public", "data", "crypto-liquidity.json");
const equityFastPath = resolve(appRoot, "public", "data", "equity-fast.json");
const marketSessionPath = resolve(appRoot, "public", "data", "market-session.json");
const CMC_GLOBAL_URL = "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest?convert=USD";
const CMC_QUOTES_URL = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=1,825,3408&convert=USD";
const SOSO_URL = "https://openapi.sosovalue.com/openapi/v2/etf/historicalInflowChart";
const BLOCKBEATS_URL = "https://api-pro.theblockbeats.info/v1/data/btc_etf";

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
  for (const value of [process.env.CMC_PRO_API_KEY, process.env.SOSOVALUE_API_KEY, process.env.BLOCKBEATS_API_KEY]) {
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

async function fetchCmcMetrics() {
  const key = process.env.CMC_PRO_API_KEY;
  if (!key) throw new Error("CMC_PRO_API_KEY is not configured");
  const headers = { "X-CMC_PRO_API_KEY": key };
  const [globalPayload, quotesPayload] = await Promise.all([
    fetchJson(CMC_GLOBAL_URL, { headers }),
    fetchJson(CMC_QUOTES_URL, { headers }),
  ]);
  return normalizeCmcLiquidity(globalPayload, quotesPayload);
}

async function fetchSosoAsset(asset) {
  const key = process.env.SOSOVALUE_API_KEY;
  if (!key) throw new Error("SOSOVALUE_API_KEY is not configured");
  const payload = await fetchJson(SOSO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-soso-api-key": key },
    body: JSON.stringify({ type: `us-${asset.toLowerCase()}-spot` }),
  });
  if (Number(payload?.code) !== 0) throw new Error(`SoSoValue ${asset} request failed`);
  return requireSosoEtfHistory(normalizeSosoEtfHistory(payload, asset), asset);
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
try {
  metrics = await fetchCmcMetrics();
  freshSourceCount += 1;
} catch (error) {
  failures.push(`CMC: ${safeFailure(error)}`);
}

if (!metrics) {
  if (existing?.metrics?.length) metrics = existing.metrics.map(({ change1d, change7d, ...item }) => item);
  else metrics = localFallbackMetrics(await readJson(equityFastPath, {}), await readJson(marketSessionPath, {}));
}

const etf = { ...(existing?.etf || {}) };
for (const asset of ["BTC", "ETH"]) {
  try {
    etf[asset] = await fetchSosoAsset(asset);
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
etf.SOL ||= {
  asset: "SOL",
  cadence: "weekly_or_daily_pending",
  status: "pending_reviewed_source",
  source: null,
  observedAt: null,
  daily: [],
  weekly: [],
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
const history = mergeMetricHistory(existing?.history, metrics);
metrics = attachMetricChanges(metrics, history);
const observedAt = oldest([
  ...metrics.filter((item) => item.value != null).map((item) => item.observedAt),
  ...Object.values(etf).filter((item) => item.status === "available").map((item) => item.observedAt),
]);

const output = {
  version: CRYPTO_LIQUIDITY_VERSION,
  page: "crypto-liquidity",
  generatedAt: transformedAt,
  timestamps: {
    observedAt,
    fetchedAt: freshSourceCount ? transformedAt : oldest(metrics.map((item) => item.observedAt)),
    transformedAt,
  },
  status: failures.length ? "partial" : "available",
  metrics,
  history,
  etf,
  auxiliarySources: { blockbeats },
  methodology: {
    marketCaps: "Market-cap changes are valuation changes, not capital inflows. CoinMarketCap supplies current aggregate and asset market caps.",
    stablecoins: "USDT and USDC market caps proxy circulating supply in USD. Their sum is labelled as tracked major stablecoins, not the entire stablecoin market.",
    usdtPeg: "USDT peg deviation is (price - 1 USD) × 10,000 basis points and is not a flow metric.",
    etf: "SoSoValue daily aggregate net flow is used for reviewed U.S. BTC and ETH spot ETF series. Missing trading days remain missing and are never filled with zero.",
    sol: "SOL ETF flow remains pending until a reviewed source with suitable redistribution terms is configured.",
    blockbeats: "BlockBeats is reserved as an auxiliary BTC cross-check only and never overwrites the primary ETF series.",
  },
  sources: {
    cmc: "https://coinmarketcap.com/api/documentation/pro-api-reference/",
    sosovalue: "https://sosovalue.gitbook.io/soso-value-api-doc/api-document/get-etf-historical-inflow-chart",
    blockbeats: "https://www.theblockbeats.info/apiDoc",
  },
  failures,
};

await writeJsonAtomic(outputPath, output);
console.log(JSON.stringify({ status: output.status, metrics: metrics.length, etfAssets: Object.keys(etf), failures: failures.length }));
