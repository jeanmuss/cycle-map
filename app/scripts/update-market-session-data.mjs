import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildOfficialMarketCalendar } from "./market-session-calendar.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(appRoot, "..");
const outputPath = resolve(appRoot, "public/data/market-session.json");
const execFileAsync = promisify(execFile);

const OKX_BASE = "https://www.okx.com/api/v5";
const CMC_BASE = "https://pro-api.coinmarketcap.com/v2";

const MARKETS = [
  {
    id: "crypto",
    displayName: "Crypto",
    displayNameZh: "加密市场",
    timezone: "UTC",
    stateModel: "always_open",
    assets: ["BTC", "USDT", "HYPE", "BNB"],
  },
  {
    id: "us",
    displayName: "U.S. risk",
    displayNameZh: "美国风险",
    timezone: "America/New_York",
    stateModel: "premarket_regular_afterhours",
    sessionTemplates: [
      { key: "premarket", start: "04:00", end: "09:30", active: true, sortRank: 1 },
      { key: "open", start: "09:30", end: "16:00", active: true, sortRank: 1 },
      { key: "afterhours", start: "16:00", end: "20:00", active: true, sortRank: 2 },
    ],
    assets: ["TSLA", "NVDA", "MSFT", "CL"],
  },
  {
    id: "kr",
    displayName: "Korea",
    displayNameZh: "韩国市场",
    timezone: "Asia/Seoul",
    stateModel: "premarket_regular_afterhours",
    sessionTemplates: [
      { key: "premarket", start: "08:00", end: "09:00", active: true, sortRank: 1 },
      { key: "open", start: "09:00", end: "15:30", active: true, sortRank: 1 },
      { key: "afterhours", start: "15:40", end: "18:00", active: true, sortRank: 2 },
    ],
    assets: ["KOSPI200", "SAMSUNG", "SKHYNIX"],
  },
  {
    id: "cn",
    displayName: "China",
    displayNameZh: "中国市场",
    timezone: "Asia/Shanghai",
    stateModel: "china_auction_regular_afterhours",
    sessionTemplates: [
      { key: "opening-auction", start: "09:15", end: "09:25", active: true, sortRank: 1 },
      { key: "open", start: "09:30", end: "11:30", active: true, sortRank: 1 },
      { key: "lunch", start: "11:30", end: "13:00", active: false, sortRank: 3 },
      { key: "open", start: "13:00", end: "14:57", active: true, sortRank: 1 },
      { key: "closing-auction", start: "14:57", end: "15:00", active: true, sortRank: 1 },
      { key: "fixed-price-gap", start: "15:00", end: "15:05", active: false, sortRank: 3, effectiveFrom: "2026-07-06" },
      { key: "fixed-price", start: "15:05", end: "15:30", active: true, sortRank: 2, effectiveFrom: "2026-07-06" },
    ],
    assets: ["CSI500", "SSE50"],
  },
];

const ASSETS = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    nameZh: "Bitcoin",
    market: "crypto",
    quote: "USDT",
    okx: { type: "ticker", instId: "BTC-USDT" },
    cmcSymbol: "BTC",
    cmcSlug: "bitcoin",
  },
  {
    symbol: "USDT",
    name: "Tether USDt",
    nameZh: "Tether USDt",
    market: "crypto",
    quote: "USD",
    okx: { type: "ticker", instId: "USDT-USD" },
    cmcSymbol: "USDT",
    cmcSlug: "tether",
    note: "USDT/USD is a peg-pressure proxy, not a direct flow measurement.",
  },
  {
    symbol: "HYPE",
    name: "Hyperliquid",
    nameZh: "Hyperliquid",
    market: "crypto",
    quote: "USDT",
    okx: { type: "ticker", instId: "HYPE-USDT" },
    cmcSymbol: "HYPE",
    cmcSlug: "hyperliquid",
  },
  {
    symbol: "BNB",
    name: "BNB",
    nameZh: "BNB",
    market: "crypto",
    quote: "USDT",
    okx: { type: "ticker", instId: "BNB-USDT" },
    cmcSymbol: "BNB",
    cmcSlug: "bnb",
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    nameZh: "Tesla",
    market: "us",
    quote: "USD",
    okx: { type: "ticker", instId: "TSLA-USDT-SWAP" },
    sourceKind: "proxy",
    quality: "OKX equity swap proxy; official U.S. equity feed pending.",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    nameZh: "NVIDIA",
    market: "us",
    quote: "USD",
    okx: { type: "ticker", instId: "NVDA-USDT-SWAP" },
    sourceKind: "proxy",
    quality: "OKX equity swap proxy; official U.S. equity feed pending.",
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    nameZh: "Microsoft",
    market: "us",
    quote: "USD",
    okx: { type: "ticker", instId: "MSFT-USDT-SWAP" },
    sourceKind: "proxy",
    quality: "OKX equity swap proxy; official U.S. equity feed pending.",
  },
  {
    symbol: "CL",
    name: "OKX CL Index",
    nameZh: "OKX CL 指数",
    market: "us",
    quote: "USD",
    okx: { type: "index", instId: "CL-USDT" },
    sourceKind: "proxy",
    marketCapNotApplicable: true,
    quality: "OKX CL index proxy; primarily Hyperliquid Oracle plus OKX linear perpetual components.",
  },
  {
    symbol: "KOSPI200",
    name: "KOSPI 200",
    nameZh: "KOSPI 200",
    market: "kr",
    quote: "USD",
    sourceKind: "pending",
    quality: "Price source pending; status rotation is calculated locally from KRX pre-market, regular, and after-hours session rules.",
  },
  {
    symbol: "SAMSUNG",
    name: "Samsung Electronics",
    nameZh: "Samsung Electronics",
    market: "kr",
    quote: "USD",
    localQuote: "KRW",
    sourceKind: "pending",
    quality: "KRW price and USD conversion source pending.",
  },
  {
    symbol: "SKHYNIX",
    name: "SK hynix",
    nameZh: "SK hynix",
    market: "kr",
    quote: "USD",
    localQuote: "KRW",
    sourceKind: "pending",
    quality: "KRW price and USD conversion source pending.",
  },
  {
    symbol: "CSI500",
    name: "CSI 500",
    nameZh: "中证500",
    market: "cn",
    quote: "CNY",
    sourceKind: "pending",
    sessionEligibility: "non_tradable_index_proxy",
    quality: "Non-tradable China index proxy; session status describes eligible A-shares and exchange-traded open-end funds, not the index itself. Price source pending; market cap may remain unavailable.",
  },
  {
    symbol: "SSE50",
    name: "SSE 50",
    nameZh: "上证50",
    market: "cn",
    quote: "CNY",
    sourceKind: "pending",
    sessionEligibility: "non_tradable_index_proxy",
    quality: "Non-tradable China index proxy; session status describes eligible A-shares and exchange-traded open-end funds, not the index itself. Price source pending; market cap may remain unavailable.",
  },
];

function loadEnvFile(path) {
  return readFile(path, "utf8")
    .then((text) => {
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
    })
    .catch(() => {});
}

function isoNow() {
  return new Date().toISOString();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function latestIso(values) {
  const valid = values
    .filter((value) => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return valid[0] || null;
}

function attachOfficialCalendars(markets, generatedAt) {
  return markets.map((market) => {
    const official = buildOfficialMarketCalendar(market, new Date(generatedAt));
    return {
      ...market,
      ...official,
      nextTransitionAt: official.generatedStatus.nextTransitionAt,
    };
  });
}

function pctChange(openValue, closeValue) {
  if (!Number.isFinite(openValue) || !Number.isFinite(closeValue) || openValue === 0) return null;
  return ((closeValue - openValue) / openValue) * 100;
}

function okxIso(ts) {
  const number = Number(ts);
  return Number.isFinite(number) ? new Date(number).toISOString() : null;
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
          "User-Agent": "cycle-map-market-session/1.0",
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
  const usesCmc = url.includes("coinmarketcap.com");
  const hasCmcKey = Boolean(process.env.CMC_PRO_API_KEY);
  if (usesCmc && !hasCmcKey) throw new Error("CMC_PRO_API_KEY is not configured");
  const script = `
    $Url = $env:CYCLE_MAP_FETCH_URL
    $UsesCmc = $env:CYCLE_MAP_FETCH_CMC
    $headers = @{
      Accept = 'application/json'
      'User-Agent' = 'cycle-map-market-session/1.0'
    }
    if ($UsesCmc -eq '1') {
      $headers['X-CMC_PRO_API_KEY'] = $env:CMC_PRO_API_KEY
    }
    $response = Invoke-RestMethod -Uri $Url -Headers $headers -TimeoutSec 25
    $response | ConvertTo-Json -Depth 40 -Compress
  `;
  const { stdout } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      env: {
        ...process.env,
        CYCLE_MAP_FETCH_URL: url,
        CYCLE_MAP_FETCH_CMC: usesCmc ? "1" : "0",
      },
      maxBuffer: 5 * 1024 * 1024,
      windowsHide: true,
    },
  );
  return JSON.parse(stdout);
}

async function fetchOkxAsset(asset) {
  if (!asset.okx) return null;
  if (asset.okx.type === "index") {
    const payload = await fetchJson(`${OKX_BASE}/market/index-tickers?instId=${asset.okx.instId}`);
    const row = payload?.data?.[0];
    const price = finiteNumber(row?.idxPx);
    const open = finiteNumber(row?.sodUtc0 ?? row?.open24h);
    let components = null;
    try {
      const componentPayload = await fetchJson(`${OKX_BASE}/market/index-components?index=${asset.okx.instId}`);
      components = (componentPayload?.data?.components || []).map((item) => ({
        exchange: item.exch,
        symbol: item.symbol,
        weight: finiteNumber(item.wgt),
      }));
    } catch {
      components = null;
    }
    return {
      price,
      changePct: pctChange(open, price),
      changeBasis: "UTC day",
      asOf: okxIso(row?.ts),
      sourceLabel: "OKX index ticker",
      sourceUrl: `${OKX_BASE}/market/index-tickers`,
      components,
    };
  }

  const payload = await fetchJson(`${OKX_BASE}/market/ticker?instId=${asset.okx.instId}`);
  const row = payload?.data?.[0];
  const price = finiteNumber(row?.last);
  const open = finiteNumber(row?.sodUtc0 ?? row?.open24h);
  return {
    price,
    changePct: pctChange(open, price),
    changeBasis: "UTC day",
    asOf: okxIso(row?.ts),
    sourceLabel: asset.okx.instId.endsWith("-SWAP") ? "OKX swap ticker proxy" : "OKX spot ticker",
    sourceUrl: `${OKX_BASE}/market/ticker`,
  };
}

function pickCmcRow(symbol, rows, preferredSlug) {
  if (!Array.isArray(rows)) return null;
  return rows.find((row) => row.slug === preferredSlug)
    || rows.find((row) => row.symbol === symbol && row.is_active === 1)
    || rows[0]
    || null;
}

async function fetchCmcMarketCaps(failures) {
  const key = process.env.CMC_PRO_API_KEY;
  if (!key) {
    failures.push("CMC_PRO_API_KEY is not configured for this shell; crypto market caps are unavailable.");
    return {};
  }
  const symbols = [...new Set(ASSETS.filter((asset) => asset.cmcSymbol).map((asset) => asset.cmcSymbol))].join(",");
  const payload = await fetchJson(`${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${symbols}&convert=USD`, {
    headers: { "X-CMC_PRO_API_KEY": key },
  });
  const output = {};
  for (const asset of ASSETS.filter((item) => item.cmcSymbol)) {
    const row = pickCmcRow(asset.cmcSymbol, payload?.data?.[asset.cmcSymbol], asset.cmcSlug);
    const quote = row?.quote?.USD;
    output[asset.symbol] = {
      marketCapUsd: finiteNumber(quote?.market_cap),
      marketCapAsOf: quote?.last_updated || null,
      cmcId: row?.id || null,
      sourceLabel: "CoinMarketCap quotes/latest",
    };
  }
  return output;
}

async function buildOutput() {
  await loadEnvFile(resolve(appRoot, ".env.local"));
  await loadEnvFile(resolve(workspaceRoot, ".env.local"));

  const failures = [];
  let cmc = {};
  try {
    cmc = await fetchCmcMarketCaps(failures);
  } catch (error) {
    failures.push(`CMC market caps: ${error instanceof Error ? error.message : String(error)}`);
  }

  const assets = [];
  for (const asset of ASSETS) {
    let quote = null;
    try {
      quote = await fetchOkxAsset(asset);
    } catch (error) {
      failures.push(`${asset.symbol} OKX quote: ${error instanceof Error ? error.message : String(error)}`);
    }
    const cmcRow = cmc[asset.symbol] || {};
    assets.push({
      symbol: asset.symbol,
      name: asset.name,
      nameZh: asset.nameZh,
      market: asset.market,
      quote: asset.quote,
      localQuote: asset.localQuote || null,
      price: quote?.price ?? null,
      changePct: quote?.changePct ?? null,
      changeBasis: quote?.changeBasis || null,
      marketCapUsd: asset.marketCapNotApplicable ? null : cmcRow.marketCapUsd ?? null,
      marketCapStatus: asset.marketCapNotApplicable ? "not_applicable" : cmcRow.marketCapUsd ? "available" : "unavailable",
      marketCapAsOf: cmcRow.marketCapAsOf || null,
      asOf: quote?.asOf || cmcRow.marketCapAsOf || null,
      sourceKind: asset.sourceKind || "official_public",
      ...(asset.sessionEligibility ? { sessionEligibility: asset.sessionEligibility } : {}),
      sourceLabel: quote?.sourceLabel || asset.quality || "Source pending",
      marketCapSourceLabel: cmcRow.sourceLabel || null,
      quality: asset.quality || asset.note || null,
      components: quote?.components || null,
    });
  }

  const fetchedAt = isoNow();
  const transformedAt = isoNow();
  const observedAt = latestIso(assets.flatMap((asset) => [asset.asOf, asset.marketCapAsOf]));
  return {
    version: 2,
    page: "market-clock",
    generatedAt: transformedAt,
    timestamps: {
      observedAt,
      fetchedAt,
      transformedAt,
    },
    refreshCadence: "Target 10-15 minutes when a backend scheduler is available; static hosts may refresh less frequently.",
    methodology: "The frontend reads only this generated JSON. OKX public tickers provide crypto, equity-swap proxy, and CL index proxy prices. CoinMarketCap supplies crypto market caps when CMC_PRO_API_KEY is configured in backend or CI. The backend expands reviewed NYSE, KRX, SSE, and SZSE calendars and trading rules into absolute status intervals with holiday, early-close, weekend, and next-transition boundaries; the frontend only selects the current interval and renders its countdown.",
    failures,
    markets: attachOfficialCalendars(MARKETS, transformedAt),
    assets,
    sources: {
      okx: "https://www.okx.com/docs-v5/en/",
      cmc: "https://coinmarketcap.com/api/documentation/v1/",
      nyseCalendar: "https://www.nyse.com/trade/hours-calendars",
      krxCalendar: "https://global.krx.co.kr/contents/GLB/06/0602/0602010201/GLB0602010201T1.jsp",
      sseCalendar: "https://www.sse.com.cn/disclosure/dealinstruc/closed/",
      sseTradingRules: "https://www.sse.com.cn/lawandrules/sselawsrules2025/stocks/exchange/c/c_20260424_10816482.shtml",
      szseTradingRules: "https://www.szse.cn/lawrules/rule/allrules/bussiness/t20260424_620190.html",
      note: "No provider credentials are emitted to the frontend cache.",
    },
  };
}

async function buildCalendarOnlyOutput() {
  const existing = JSON.parse(await readFile(outputPath, "utf8"));
  const transformedAt = isoNow();
  const observedAt = latestIso((existing.assets || []).flatMap((asset) => [asset.asOf, asset.marketCapAsOf]));
  const assetDefinitions = new Map(ASSETS.map((asset) => [asset.symbol, asset]));
  const assets = (existing.assets || []).map((asset) => {
    const sessionEligibility = assetDefinitions.get(asset.symbol)?.sessionEligibility;
    return sessionEligibility ? { ...asset, sessionEligibility } : asset;
  });
  return {
    ...existing,
    version: 2,
    generatedAt: transformedAt,
    timestamps: {
      observedAt: existing.timestamps?.observedAt || observedAt,
      fetchedAt: existing.timestamps?.fetchedAt || existing.generatedAt || null,
      transformedAt,
    },
    methodology: "The frontend reads only this generated JSON. Market sessions are expanded by the backend from reviewed NYSE, KRX, SSE, and SZSE calendars and trading rules into absolute status intervals with holiday, early-close, weekend, and next-transition boundaries; the frontend only renders the current interval and countdown.",
    markets: attachOfficialCalendars(MARKETS, transformedAt),
    assets,
    sources: {
      ...(existing.sources || {}),
      nyseCalendar: "https://www.nyse.com/trade/hours-calendars",
      krxCalendar: "https://global.krx.co.kr/contents/GLB/06/0602/0602010201/GLB0602010201T1.jsp",
      sseCalendar: "https://www.sse.com.cn/disclosure/dealinstruc/closed/",
      sseTradingRules: "https://www.sse.com.cn/lawandrules/sselawsrules2025/stocks/exchange/c/c_20260424_10816482.shtml",
      szseTradingRules: "https://www.szse.cn/lawrules/rule/allrules/bussiness/t20260424_620190.html",
    },
  };
}

const output = process.argv.includes("--calendar-only") ? await buildCalendarOnlyOutput() : await buildOutput();
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: "updated",
  outputPath,
  assets: output.assets.length,
  failures: output.failures.length,
}));
