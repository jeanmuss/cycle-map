import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(appRoot, "..");
const outputPath = resolve(appRoot, "public/data/chip-chain-hotspots.json");
const execFileAsync = promisify(execFile);

const ALPACA_DATA_BASE = process.env.ALPACA_DATA_BASE_URL || "https://data.alpaca.markets";
const US_FEED = (process.env.CHIP_CHAIN_US_FEED || "iex").trim().toLowerCase();
const RANGE_CONFIG = {
  "1d": { days: 2, timeframe: "5Min", limit: 400 },
  "5d": { days: 10, timeframe: "30Min", limit: 700 },
  "1m": { days: 45, timeframe: "1Day", limit: 80 },
  "3m": { days: 120, timeframe: "1Day", limit: 150 },
};
const BENCHMARK_SYMBOLS = ["SOXX", "QQQ"];

async function loadEnvFile(path) {
  try {
    const text = await readFile(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
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
  } catch {
    // Local env files are optional.
  }
}

function isoNow() {
  return new Date().toISOString();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pctChange(openValue, closeValue) {
  if (!Number.isFinite(openValue) || !Number.isFinite(closeValue) || openValue === 0) return null;
  return ((closeValue - openValue) / openValue) * 100;
}

function alpacaKeyId() {
  return process.env.APCA_API_KEY_ID || process.env.ALPACA_API_KEY_ID || "";
}

function alpacaSecretKey() {
  return process.env.APCA_API_SECRET_KEY || process.env.ALPACA_API_SECRET_KEY || "";
}

function hasAlpacaCredentials() {
  return Boolean(alpacaKeyId() && alpacaSecretKey());
}

function redactSecret(text) {
  let output = String(text || "");
  for (const secret of [alpacaKeyId(), alpacaSecretKey()]) {
    if (secret) output = output.replaceAll(secret, "[REDACTED]");
  }
  return output;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "cycle-map-chip-chain/1.0",
          ...(options.headers || {}),
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      if (process.platform !== "win32") throw error;
      return await fetchJsonWithPowerShell(url, options);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithPowerShell(url, options = {}) {
  const headers = options.headers || {};
  const script = `
    $headers = @{
      Accept = 'application/json'
      'User-Agent' = 'cycle-map-chip-chain/1.0'
    }
    if ($env:ALPACA_KEY_ID) {
      $headers['APCA-API-KEY-ID'] = $env:ALPACA_KEY_ID
      $headers['APCA-API-SECRET-KEY'] = $env:ALPACA_SECRET_KEY
    }
    $response = Invoke-RestMethod -Uri $env:CYCLE_MAP_FETCH_URL -Headers $headers -TimeoutSec 25
    $response | ConvertTo-Json -Depth 80 -Compress
  `;
  const { stdout } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      env: {
        ...process.env,
        CYCLE_MAP_FETCH_URL: url,
        ALPACA_KEY_ID: headers["APCA-API-KEY-ID"] || "",
        ALPACA_SECRET_KEY: headers["APCA-API-SECRET-KEY"] || "",
      },
      maxBuffer: 12 * 1024 * 1024,
      windowsHide: true,
    },
  );
  return JSON.parse(stdout);
}

function alpacaHeaders() {
  return {
    "APCA-API-KEY-ID": alpacaKeyId(),
    "APCA-API-SECRET-KEY": alpacaSecretKey(),
  };
}

function startIso(days) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

function barClose(bar) {
  return finiteNumber(bar?.c ?? bar?.close);
}

function barTime(bar) {
  return bar?.t || bar?.timestamp || null;
}

function normalizeBars(bars, range) {
  const rows = (Array.isArray(bars) ? bars : [])
    .map((bar) => ({
      t: barTime(bar),
      c: barClose(bar),
      v: finiteNumber(bar?.v ?? bar?.volume),
    }))
    .filter((bar) => bar.t && Number.isFinite(bar.c))
    .sort((a, b) => String(a.t).localeCompare(String(b.t)));
  if (range !== "1d" || !rows.length) return rows;
  const latestDay = String(rows[rows.length - 1].t).slice(0, 10);
  return rows.filter((bar) => String(bar.t).slice(0, 10) === latestDay);
}

async function fetchAlpacaBars(symbol, range) {
  const config = RANGE_CONFIG[range];
  const params = new URLSearchParams({
    timeframe: config.timeframe,
    start: startIso(config.days),
    adjustment: "raw",
    feed: US_FEED || "iex",
    limit: String(config.limit),
    sort: "asc",
  });
  const url = `${ALPACA_DATA_BASE}/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`;
  const payload = await fetchJson(url, { headers: alpacaHeaders() });
  return normalizeBars(payload?.bars || [], range);
}

async function fetchSymbolPaths(symbol, failures) {
  const pricePaths = {};
  for (const range of Object.keys(RANGE_CONFIG)) {
    try {
      const bars = await fetchAlpacaBars(symbol, range);
      if (bars.length >= 2) pricePaths[range] = bars;
      else failures.push(`${symbol} ${range}: insufficient Alpaca bars`);
    } catch (error) {
      failures.push(`${symbol} ${range} Alpaca bars: ${redactSecret(error instanceof Error ? error.message : String(error))}`);
    }
  }
  return pricePaths;
}

function returnFromPath(path) {
  if (!Array.isArray(path) || path.length < 2) return null;
  return pctChange(path[0].c, path[path.length - 1].c);
}

function latestFromPaths(paths) {
  const candidates = Object.values(paths)
    .filter(Array.isArray)
    .flat()
    .filter((row) => row.t && Number.isFinite(row.c))
    .sort((a, b) => String(a.t).localeCompare(String(b.t)));
  const latest = candidates[candidates.length - 1] || null;
  return latest ? { price: latest.c, asOf: latest.t } : { price: null, asOf: null };
}

function averageVolumeRatio(path) {
  if (!Array.isArray(path) || path.length < 2) return null;
  const volumes = path.map((row) => row.v).filter(Number.isFinite);
  if (volumes.length < 2) return null;
  const latest = volumes[volumes.length - 1];
  const previous = volumes.slice(0, -1);
  const average = previous.reduce((sum, value) => sum + value, 0) / previous.length;
  return average > 0 ? latest / average : null;
}

function week52PositionFromPath(path, latestPrice) {
  if (!Array.isArray(path) || !path.length || !Number.isFinite(latestPrice)) return null;
  const closes = path.map((row) => row.c).filter(Number.isFinite);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high === low) return null;
  return (latestPrice - low) / (high - low);
}

function benchmarkReturns(pathsBySymbol) {
  const soxx = {};
  const qqq = {};
  for (const range of Object.keys(RANGE_CONFIG)) {
    soxx[range] = returnFromPath(pathsBySymbol.SOXX?.[range]);
    qqq[range] = returnFromPath(pathsBySymbol.QQQ?.[range]);
  }
  return { soxx, qqq };
}

function updateAssetFromPaths(asset, paths, benchmarks, asOfNow) {
  const returns = {};
  for (const range of Object.keys(RANGE_CONFIG)) {
    const value = returnFromPath(paths[range]);
    returns[range] = value ?? asset.returns?.[range] ?? null;
  }
  const latest = latestFromPaths(paths);
  const oneDayVolumeRatio = averageVolumeRatio(paths["1d"]);
  const week52Position = week52PositionFromPath(paths["3m"], latest.price);
  return {
    ...asset,
    price: latest.price ?? asset.price,
    returns,
    relative: {
      soxx: Number.isFinite(returns["1d"]) && Number.isFinite(benchmarks.soxx["1d"]) ? returns["1d"] - benchmarks.soxx["1d"] : asset.relative?.soxx ?? null,
      qqq: Number.isFinite(returns["1d"]) && Number.isFinite(benchmarks.qqq["1d"]) ? returns["1d"] - benchmarks.qqq["1d"] : asset.relative?.qqq ?? null,
    },
    volumeRatio: oneDayVolumeRatio ?? asset.volumeRatio ?? null,
    week52Position: week52Position ?? asset.week52Position ?? null,
    sourceKind: "live_cache",
    sourceLabel: `Alpaca ${US_FEED || "iex"} stock bars`,
    sourceUrl: "https://docs.alpaca.markets/reference/stockbars",
    dataQuality: US_FEED === "iex"
      ? "official_alpaca_iex_feed_limited_venue"
      : `official_alpaca_${US_FEED}_feed`,
    pricePaths: paths,
    asOf: latest.asOf || asOfNow,
  };
}

function markNonUsPending(asset) {
  return {
    ...asset,
    sourceKind: asset.sourceKind === "live_cache" ? "provider_pending" : asset.sourceKind,
    dataQuality: asset.market === "kr"
      ? "Korea price adapter pending; retaining existing sample/static row."
      : asset.dataQuality || "Non-U.S. adapter pending.",
  };
}

async function buildOutput(existing) {
  const failures = [];
  const usSymbols = Object.values(existing.assets || {})
    .filter((asset) => asset.market === "us")
    .map((asset) => asset.symbol);
  const fetchSymbols = [...new Set([...usSymbols, ...BENCHMARK_SYMBOLS])];
  const pathsBySymbol = {};

  for (const symbol of fetchSymbols) {
    pathsBySymbol[symbol] = await fetchSymbolPaths(symbol, failures);
  }

  const benchmarks = benchmarkReturns(pathsBySymbol);
  const asOfNow = isoNow();
  const assets = {};
  for (const [symbol, asset] of Object.entries(existing.assets || {})) {
    if (asset.market === "us" && pathsBySymbol[symbol] && Object.keys(pathsBySymbol[symbol]).length) {
      assets[symbol] = updateAssetFromPaths(asset, pathsBySymbol[symbol], benchmarks, asOfNow);
    } else {
      assets[symbol] = markNonUsPending(asset);
      if (asset.market !== "us") failures.push(`${symbol}: non-U.S. provider adapter pending; existing row retained.`);
    }
  }

  const liveCount = Object.values(assets).filter((asset) => asset.sourceKind === "live_cache").length;
  if (!liveCount) throw new Error("No live chip-chain assets were refreshed");

  return {
    ...existing,
    generatedAt: asOfNow,
    kind: liveCount === Object.keys(existing.assets || {}).length ? "market_cache" : "market_cache_partial",
    refreshCadence: "U.S. equities refresh from backend/CI Alpaca cache when credentials are configured. Korea adapter is pending KIS/KRX review; retained rows are visibly marked by sourceKind/dataQuality.",
    methodology: "Category returns are equal-weighted from visible assets for the selected window. U.S. price paths come from backend/CI Alpaca stock bars when configured; the frontend reads only this static JSON and never receives provider credentials.",
    failures,
    sources: [
      {
        market: "US",
        label: `Alpaca ${US_FEED || "iex"} stock bars via backend/CI cache.`,
        plannedRefresh: "15-30 min during U.S. regular sessions; close cache after market close.",
      },
      {
        market: "KR",
        label: "Korea Investment Open API / KRX quote adapter pending; existing sample/static rows retained until reviewed credentials and redistribution terms are configured.",
        plannedRefresh: "30 min during KRX regular sessions; close cache after market close.",
      },
    ],
    assets,
  };
}

async function main() {
  await loadEnvFile(resolve(appRoot, ".env.local"));
  await loadEnvFile(resolve(workspaceRoot, ".env.local"));

  const existing = JSON.parse(await readFile(outputPath, "utf8"));
  if (!hasAlpacaCredentials()) {
    console.log(JSON.stringify({
      status: "kept-last-known-good",
      outputPath,
      reason: "APCA_API_KEY_ID/APCA_API_SECRET_KEY or ALPACA_API_KEY_ID/ALPACA_API_SECRET_KEY are not configured.",
      kind: existing.kind,
      generatedAt: existing.generatedAt,
    }));
    return;
  }

  let output;
  try {
    output = await buildOutput(existing);
  } catch (error) {
    console.log(JSON.stringify({
      status: "kept-last-known-good",
      outputPath,
      reason: redactSecret(error instanceof Error ? error.message : String(error)),
      kind: existing.kind,
      generatedAt: existing.generatedAt,
    }));
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "updated",
    outputPath,
    kind: output.kind,
    liveAssets: Object.values(output.assets).filter((asset) => asset.sourceKind === "live_cache").length,
    failures: output.failures.length,
  }));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({
    status: "failed",
    outputPath,
    error: redactSecret(error instanceof Error ? error.message : String(error)),
  }));
  process.exitCode = 1;
}
