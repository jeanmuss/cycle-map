import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const outputPath = resolve(appRoot, "public/data/market-monthly.json");
const legacyBtcPath = resolve(appRoot, "../.reference/original/data/monthly-seed.json");

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const REQUIRED_ASSETS = ["BTC", "ETH", "SOL", "HYPE", "BNB"];
const now = new Date();
const nowMs = now.getTime();
const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

function monthKeyFromMs(ms) {
  const date = new Date(Number(ms));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthStartMs(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return Date.UTC(year, month - 1, 1);
}

function offsetMonthKey(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  return monthKeyFromMs(Date.UTC(year, month - 1 + offset, 1));
}

function isoTime(ms) {
  return Number.isFinite(Number(ms)) ? new Date(Number(ms)).toISOString() : null;
}

function orderedIso(values, direction = "latest") {
  const valid = values
    .filter((value) => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return direction === "oldest" ? valid[0] || null : valid.at(-1) || null;
}

function hasDirectionalExtremes(row) {
  if (row?.orderResolution === "1M-order-unavailable") return true;
  return Number.isFinite(row?.extremeMovePct)
    && ["high", "low", "flat"].includes(row?.firstExtreme)
    && typeof row?.highTime === "string"
    && typeof row?.lowTime === "string";
}

function incrementalStartMs(existingRows, fallbackStartMs = 0) {
  const missing = existingRows.find((row) => !hasDirectionalExtremes(row));
  if (missing) return Math.max(fallbackStartMs, monthStartMs(missing.monthKey));
  const latest = existingRows.at(-1);
  if (!latest) return fallbackStartMs;
  return Math.max(fallbackStartMs, monthStartMs(offsetMonthKey(latest.monthKey, -1)));
}

function directionalFields(row, resolution = row.orderResolution || "1d") {
  const high = Number(row.high);
  const low = Number(row.low);
  const highMs = Date.parse(row.highTime);
  const lowMs = Date.parse(row.lowTime);

  let firstExtreme;
  let orderResolution = resolution;
  if (!Number.isFinite(high) || !Number.isFinite(low) || low <= 0) {
    return { firstExtreme: null, extremeMovePct: null, orderResolution };
  }
  if (!Number.isFinite(highMs) || !Number.isFinite(lowMs)) {
    return { firstExtreme: null, extremeMovePct: null, orderResolution };
  }
  if (high === low) {
    firstExtreme = "flat";
  } else if (highMs < lowMs) {
    firstExtreme = "high";
  } else if (lowMs < highMs) {
    firstExtreme = "low";
  } else {
    // Only used if high and low occur inside the same one-minute candle.
    // The candle direction is the narrowest public-data proxy available.
    firstExtreme = Number(row.close) >= Number(row.open) ? "low" : "high";
    orderResolution = `${resolution}-direction-proxy`;
  }

  const extremeMovePct = firstExtreme === "flat"
    ? 0
    : firstExtreme === "low"
      ? ((high - low) / low) * 100
      : ((low - high) / high) * 100;
  return { firstExtreme, extremeMovePct, orderResolution };
}

function normalizeRows(rows, source) {
  return rows
    .filter((row) => row?.monthKey && Number.isFinite(Number(row.open)) && Number.isFinite(Number(row.close)))
    .map((row) => {
      const open = Number(row.open);
      const close = Number(row.close);
      const candidateHigh = row.high == null ? Number.NaN : Number(row.high);
      const candidateLow = row.low == null ? Number.NaN : Number(row.low);
      const high = Number.isFinite(candidateHigh) ? candidateHigh : null;
      const low = Number.isFinite(candidateLow) ? candidateLow : null;
      const highTime = row.highTime || null;
      const lowTime = row.lowTime || null;
      const direction = directionalFields(
        { ...row, open, close, high, low, highTime, lowTime },
        row.orderResolution || "1d",
      );
      return {
        monthKey: row.monthKey,
        open,
        high,
        highTime,
        low,
        lowTime,
        close,
        closeTime: row.closeTime || row.spotAppliedAt || null,
        closeSource: row.closeSource || null,
        spotAppliedAt: row.spotAppliedAt || null,
        pct: open === 0 ? null : ((close - open) / open) * 100,
        firstExtreme: row.firstExtreme || direction.firstExtreme,
        extremeMovePct: Number.isFinite(row.extremeMovePct) ? Number(row.extremeMovePct) : direction.extremeMovePct,
        orderResolution: row.orderResolution || direction.orderResolution,
        source: row.source || source,
        extremesSource: row.extremesSource || row.source || source,
        isClosed: row.monthKey < currentMonthKey,
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

function groupCandlesByMonth(candles, source, resolution) {
  const grouped = new Map();
  for (const candle of candles) {
    const openTime = Number(candle.openTime);
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    if (![openTime, open, high, low, close].every(Number.isFinite)) continue;

    const monthKey = monthKeyFromMs(openTime);
    const current = grouped.get(monthKey);
    if (!current) {
      grouped.set(monthKey, {
        monthKey,
        open,
        high,
        highTime: isoTime(openTime),
        low,
        lowTime: isoTime(openTime),
        close,
        source,
        extremesSource: source,
        orderResolution: resolution,
      });
      continue;
    }
    if (high > current.high) {
      current.high = high;
      current.highTime = isoTime(openTime);
    }
    if (low < current.low) {
      current.low = low;
      current.lowTime = isoTime(openTime);
    }
    current.close = close;
  }
  return normalizeRows([...grouped.values()], source);
}

function mergeCachedRows(existingRows, freshRows) {
  const merged = new Map(existingRows.map((row) => [row.monthKey, row]));
  for (const row of freshRows) merged.set(row.monthKey, row);
  return normalizeRows(
    [...merged.values()],
    freshRows[0]?.source || existingRows[0]?.source || "unknown",
  );
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "cycle-map-data-cache/2.0",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBinanceSpotPrice(symbol) {
  const pair = `${symbol}USDT`;
  const endpoints = [
    `https://api.binance.me/api/v3/ticker/price?symbol=${pair}`,
    `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`,
    `https://data-api.binance.vision/api/v3/ticker/price?symbol=${pair}`,
  ];
  let lastError = null;
  for (const url of endpoints) {
    try {
      const payload = await fetchJson(url);
      const price = Number(payload?.price);
      if (!Number.isFinite(price) || price <= 0) throw new Error("invalid price");
      return {
        symbol,
        pair,
        price,
        quote: "USDT",
        updatedAt: new Date().toISOString(),
        source: url,
        sourceLabel: "Binance Spot ticker",
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`No Binance spot price for ${symbol}`);
}

async function fetchHyperliquidSpotPrice(symbol) {
  const payload = await fetchJson("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });
  const price = Number(payload?.[symbol]);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`invalid Hyperliquid mid for ${symbol}`);
  return {
    symbol,
    pair: symbol,
    price,
    quote: "USD",
    updatedAt: new Date().toISOString(),
    source: "https://api.hyperliquid.xyz/info allMids",
    sourceLabel: "Hyperliquid mid price",
  };
}

async function fetchSpotPrice(symbol) {
  if (symbol === "HYPE") return fetchHyperliquidSpotPrice(symbol);
  return fetchBinanceSpotPrice(symbol);
}

function applySpotToCurrentMonthRows(rows, spot, source) {
  if (!spot || !Number.isFinite(Number(spot.price))) return normalizeRows(rows || [], source);
  const normalized = normalizeRows(rows || [], source);
  const index = normalized.findIndex((row) => row.monthKey === currentMonthKey);
  if (index < 0) return normalized;

  const current = { ...normalized[index] };
  current.close = Number(spot.price);
  current.closeTime = spot.updatedAt;
  current.closeSource = spot.sourceLabel;
  current.spotAppliedAt = spot.updatedAt;
  current.isClosed = false;

  if (!Number.isFinite(Number(current.high)) || Number(spot.price) > Number(current.high)) {
    current.high = Number(spot.price);
    current.highTime = spot.updatedAt;
    current.orderResolution = "1d+spot";
  }
  if (!Number.isFinite(Number(current.low)) || Number(spot.price) < Number(current.low)) {
    current.low = Number(spot.price);
    current.lowTime = spot.updatedAt;
    current.orderResolution = "1d+spot";
  }

  const updated = [...normalized];
  updated[index] = current;
  return normalizeRows(updated, source);
}

function binanceCandle(row) {
  return {
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  };
}

async function fetchBinancePage(symbol, interval, startTime, endTime, limit = 1000) {
  const params = new URLSearchParams({
    symbol: `${symbol}USDT`,
    interval,
    limit: String(limit),
    startTime: String(Math.max(0, Math.floor(startTime))),
  });
  if (Number.isFinite(endTime)) params.set("endTime", String(Math.floor(endTime)));
  const payload = await fetchJson(`https://data-api.binance.vision/api/v3/klines?${params}`);
  return (payload || []).map(binanceCandle);
}

async function fetchAllBinanceDaily(symbol, startTime) {
  const injected = process.env[`${symbol}_KLINES_JSON`];
  if (injected) return JSON.parse(injected).map(binanceCandle);

  const rows = [];
  let cursor = startTime;
  for (let page = 0; page < 20 && cursor <= nowMs; page += 1) {
    const batch = await fetchBinancePage(symbol, "1d", cursor, nowMs, 1000);
    if (!batch.length) break;
    rows.push(...batch);
    const nextCursor = batch.at(-1).openTime + 1;
    if (nextCursor <= cursor) break;
    cursor = nextCursor;
    if (batch.length < 1000) break;
  }
  return rows;
}

async function refineBinanceOrder(symbol, row) {
  if (row.high === row.low || row.highTime !== row.lowTime) return row;
  const dayStart = Date.parse(row.highTime);
  let refined = groupCandlesByMonth(
    await fetchBinancePage(symbol, "1h", dayStart, dayStart + DAY_MS - 1, 1000),
    "binance-spot",
    "1h",
  )[0];
  if (!refined) return row;

  if (refined.high !== refined.low && refined.highTime === refined.lowTime) {
    const hourStart = Date.parse(refined.highTime);
    const minuteRefined = groupCandlesByMonth(
      await fetchBinancePage(symbol, "1m", hourStart, hourStart + HOUR_MS - 1, 1000),
      "binance-spot",
      "1m",
    )[0];
    if (minuteRefined) refined = minuteRefined;
  }
  return normalizeRows([{
    ...row,
    highTime: refined.highTime,
    lowTime: refined.lowTime,
    firstExtreme: null,
    extremeMovePct: null,
    orderResolution: refined.orderResolution,
  }], row.source)[0];
}

async function fetchBinanceRows(symbol, existingRows = []) {
  const startTime = incrementalStartMs(existingRows);
  const candles = await fetchAllBinanceDaily(symbol, startTime);
  let freshRows = groupCandlesByMonth(candles, "binance-spot", "1d");
  for (let index = 0; index < freshRows.length; index += 1) {
    freshRows[index] = await refineBinanceOrder(symbol, freshRows[index]);
  }
  return mergeCachedRows(existingRows, freshRows);
}

async function fetchBtcRows(existingRows = []) {
  const payload = await fetchJson(
    "https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false",
  );
  const observations = (payload?.values || [])
    .filter((point) => Number(point.y) > 0)
    .map((point) => ({
      openTime: Number(point.x) * 1000,
      open: Number(point.y),
      high: Number(point.y),
      low: Number(point.y),
      close: Number(point.y),
    }));
  const blockchainRows = groupCandlesByMonth(observations, "blockchain-info", "1d-observation");

  try {
    const binanceLaunch = Date.UTC(2017, 8, 1);
    const exchangeExisting = existingRows.filter((row) => row.monthKey >= "2017-09");
    const exchangeRows = await fetchBinanceRows("BTC", exchangeExisting);
    const exchangeMap = new Map(exchangeRows.map((row) => [row.monthKey, row]));
    return normalizeRows(
      blockchainRows.map((row) => {
        const exchangeRow = exchangeMap.get(row.monthKey);
        if (!exchangeRow || monthStartMs(row.monthKey) < binanceLaunch) return row;
        return {
          ...row,
          high: exchangeRow.high,
          highTime: exchangeRow.highTime,
          low: exchangeRow.low,
          lowTime: exchangeRow.lowTime,
          firstExtreme: exchangeRow.firstExtreme,
          extremeMovePct: exchangeRow.extremeMovePct,
          orderResolution: exchangeRow.orderResolution,
          extremesSource: "binance-spot",
        };
      }),
      "blockchain-info",
    );
  } catch {
    return blockchainRows;
  }
}

function hyperliquidCandle(row) {
  return {
    openTime: Number(row.t ?? row.T),
    open: Number(row.o),
    high: Number(row.h),
    low: Number(row.l),
    close: Number(row.c),
  };
}

async function fetchHypeCandles(interval, startTime, endTime) {
  let payload = await fetchJson("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: { coin: "HYPE", interval, startTime, endTime },
    }),
  });
  for (let index = 0; index < 2 && typeof payload === "string"; index += 1) payload = JSON.parse(payload);
  const candles = Array.isArray(payload) && payload.length === 1 && Array.isArray(payload[0]) ? payload[0] : payload;
  return (candles || []).map(hyperliquidCandle);
}

async function refineHypeOrder(row) {
  if (row.high === row.low || row.highTime !== row.lowTime || !Number.isFinite(Date.parse(row.highTime))) return row;
  const dayStart = Date.parse(row.highTime);
  let refined = groupCandlesByMonth(
    await fetchHypeCandles("1h", dayStart, dayStart + DAY_MS - 1),
    "hyperliquid",
    "1h",
  )[0];
  if (!refined) return row;

  if (refined.high !== refined.low && refined.highTime === refined.lowTime) {
    const hourStart = Date.parse(refined.highTime);
    const minuteRefined = groupCandlesByMonth(
      await fetchHypeCandles("1m", hourStart, hourStart + HOUR_MS - 1),
      "hyperliquid",
      "1m",
    )[0];
    if (minuteRefined) refined = minuteRefined;
  }
  return normalizeRows([{
    ...row,
    highTime: refined.highTime,
    lowTime: refined.lowTime,
    firstExtreme: null,
    extremeMovePct: null,
    orderResolution: refined.orderResolution,
  }], row.source)[0];
}

async function fetchHypeRows(existingRows = []) {
  const startTime = incrementalStartMs(existingRows);
  const candles = await fetchHypeCandles("1d", startTime, nowMs);
  let freshRows = groupCandlesByMonth(candles, "hyperliquid", "1d");
  const freshKeys = new Set(freshRows.map((row) => row.monthKey));
  const missingKeys = existingRows
    .filter((row) => !hasDirectionalExtremes(row) && !freshKeys.has(row.monthKey))
    .map((row) => row.monthKey);
  const cachedLaunchMonth = existingRows.find((row) => row.monthKey === "2024-11");
  if (!freshKeys.has("2024-11") && !hasDirectionalExtremes(cachedLaunchMonth)) missingKeys.push("2024-11");
  for (const monthKey of missingKeys) {
    const monthStart = monthStartMs(monthKey);
    const nextMonthStart = monthStartMs(offsetMonthKey(monthKey, 1));
    const hourlyRows = groupCandlesByMonth(
      await fetchHypeCandles("1h", monthStart, nextMonthStart - 1),
      "hyperliquid",
      "1h",
    );
    if (hourlyRows.length) {
      freshRows.push(...hourlyRows);
    } else {
      const monthlyCandle = (await fetchHypeCandles("1M", 0, nowMs))
        .find((candle) => monthKeyFromMs(candle.openTime) === monthKey);
      if (monthlyCandle) {
        freshRows.push(normalizeRows([{
          monthKey,
          open: monthlyCandle.open,
          high: monthlyCandle.high,
          highTime: null,
          low: monthlyCandle.low,
          lowTime: null,
          close: monthlyCandle.close,
          firstExtreme: null,
          extremeMovePct: null,
          orderResolution: "1M-order-unavailable",
          source: "hyperliquid",
          extremesSource: "hyperliquid",
        }], "hyperliquid")[0]);
      }
    }
  }
  for (let index = 0; index < freshRows.length; index += 1) {
    freshRows[index] = await refineHypeOrder(freshRows[index]);
  }
  return mergeCachedRows(existingRows, freshRows);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function loadInitialBtcFallback() {
  const legacy = await readJson(legacyBtcPath);
  return normalizeRows(legacy?.rows || [], "blockchain-info");
}

const existing = (await readJson(outputPath)) || { assets: {} };
const cachedRows = (symbol) => existing.version >= 4 ? existing.assets?.[symbol]?.rows || [] : [];
const attempts = [
  ["BTC", () => fetchBtcRows(cachedRows("BTC")), "Blockchain + Binance", "USD"],
  ["ETH", () => fetchBinanceRows("ETH", cachedRows("ETH")), "Binance Spot", "USDT"],
  ["SOL", () => fetchBinanceRows("SOL", cachedRows("SOL")), "Binance Spot", "USDT"],
  ["HYPE", () => fetchHypeRows(cachedRows("HYPE")), "Hyperliquid", "USD"],
  ["BNB", () => fetchBinanceRows("BNB", cachedRows("BNB")), "Binance Spot", "USDT"],
];

const assets = { ...existing.assets };
const failures = [];

for (const [symbol, fetcher, sourceLabel, quote] of attempts) {
  try {
    const rows = await fetcher();
    if (!rows.length) throw new Error("empty response");
    assets[symbol] = { symbol, quote, sourceLabel, updatedAt: new Date().toISOString(), rows };
  } catch (error) {
    failures.push(`${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    if (!assets[symbol] && symbol === "BTC") {
      const rows = await loadInitialBtcFallback();
      if (rows.length) {
        assets.BTC = {
          symbol: "BTC",
          quote: "USD",
          sourceLabel: "Blockchain.info (repository seed fallback)",
          updatedAt: new Date().toISOString(),
          rows,
        };
      }
    }
  }
}

for (const symbol of REQUIRED_ASSETS) {
  try {
    const spot = await fetchSpotPrice(symbol);
    const asset = assets[symbol];
    if (!asset?.rows?.length) throw new Error("spot fetched but monthly rows are unavailable");
    assets[symbol] = {
      ...asset,
      updatedAt: spot.updatedAt,
      spot,
      rows: applySpotToCurrentMonthRows(asset.rows, spot, asset.rows[0]?.source || asset.sourceLabel),
    };
  } catch (error) {
    failures.push(`${symbol} spot: ${error instanceof Error ? error.message : String(error)}`);
    if (assets[symbol]?.rows?.length) {
      assets[symbol] = {
        ...assets[symbol],
        rows: normalizeRows(assets[symbol].rows, assets[symbol].rows[0]?.source || assets[symbol].sourceLabel),
      };
    }
  }
}

for (const symbol of REQUIRED_ASSETS) {
  if (!assets[symbol]?.rows?.length) {
    throw new Error(`No last-known-good data for ${symbol}. Fetch failures: ${failures.join(" | ")}`);
  }
}

const transformedAt = new Date().toISOString();
const assetTimestamps = Object.values(assets).flatMap((asset) => [asset.updatedAt, asset.spot?.updatedAt]);
const output = {
  version: 5,
  timezone: "UTC",
  generatedAt: transformedAt,
  timestamps: {
    observedAt: orderedIso(assetTimestamps),
    fetchedAt: orderedIso(assetTimestamps, "oldest"),
    transformedAt,
  },
  currentMonthKey,
  spotRefreshCadence: "Hourly static cache refresh by CI; provider schedules and GitHub Actions queues can add small delays.",
  methodology: "Monthly return = (close - open) / open × 100%. Directional extreme move = (second extreme - first extreme) / first extreme × 100%, ordered by occurrence time.",
  failures,
  sources: {
    BTC: "https://api.blockchain.info/charts/market-price + https://data-api.binance.vision/api/v3/klines",
    ETH: "https://data-api.binance.vision/api/v3/klines",
    SOL: "https://data-api.binance.vision/api/v3/klines",
    HYPE: "https://api.hyperliquid.xyz/info",
    BNB: "https://data-api.binance.vision/api/v3/klines",
  },
  assets,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  outputPath,
  rows: Object.fromEntries(Object.entries(assets).map(([symbol, asset]) => [symbol, asset.rows.length])),
  failures,
}));
