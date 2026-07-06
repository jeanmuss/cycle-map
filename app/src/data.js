export const ASSETS = [
  { symbol: "BTC", name: "Bitcoin", accent: "asset-btc" },
  { symbol: "ETH", name: "Ethereum", accent: "asset-eth" },
  { symbol: "SOL", name: "Solana", accent: "asset-sol" },
  { symbol: "HYPE", name: "Hyperliquid", accent: "asset-hype" },
  { symbol: "BNB", name: "BNB", accent: "asset-bnb" },
];

export const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export const HALVING_MONTHS = new Set(["2012-11", "2016-07", "2020-05", "2024-04", "2028-04"]);
// Match the reference table: group years from BTC's first full cycle year, while labeling phases from the known halving-year anchor.
export const CYCLE_START_YEAR = 2011;
export const CYCLE_ANCHOR_YEAR = 2024;

export const APP_BASE_URL = import.meta.env.BASE_URL || "/";

export function appUrl(path = "") {
  const base = APP_BASE_URL.endsWith("/") ? APP_BASE_URL : `${APP_BASE_URL}/`;
  const cleanPath = String(path).replace(/^\/+/, "");
  return `${base}${cleanPath}`;
}

export function appHashUrl(path = "") {
  const cleanPath = String(path).replace(/^\/+/, "");
  return `${appUrl()}#/${cleanPath}`;
}

export function routePathname(pathname) {
  const path = pathname || "/";
  const basePath = new URL(APP_BASE_URL, "https://cycle-map.local").pathname.replace(/\/$/, "");
  if (basePath && path === basePath) return "/";
  if (basePath && path.startsWith(`${basePath}/`)) return path.slice(basePath.length) || "/";
  return path;
}

const CYCLE_INFO = {
  0: { label: "减半年", className: "cycle-halving" },
  1: { label: "大牛年", className: "cycle-big-bull" },
  2: { label: "回调年", className: "cycle-correction" },
  3: { label: "小牛年", className: "cycle-small-bull" },
};

export function cycleForYear(year) {
  return CYCLE_INFO[((Number(year) - CYCLE_ANCHOR_YEAR) % 4 + 4) % 4];
}

export function isCycleGroupStartYear(year) {
  return ((Number(year) - CYCLE_START_YEAR) % 4 + 4) % 4 === 0;
}

export function formatPct(value, digits = 1) {
  if (!Number.isFinite(value)) return "N/A";
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(digits)}%`;
}

export function formatPrice(value, quote = "USD") {
  if (!Number.isFinite(Number(value))) return "N/A";
  const n = Number(value);
  const maximumFractionDigits = n < 1 ? 4 : n < 100 ? 2 : 0;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(n)} ${quote}`;
}

export function returnClass(value) {
  if (!Number.isFinite(value)) return "return-na";
  if (value >= 40) return "return-up-4";
  if (value >= 20) return "return-up-3";
  if (value >= 10) return "return-up-2";
  if (value >= 0) return "return-up-1";
  if (value > -10) return "return-down-1";
  if (value > -20) return "return-down-2";
  if (value > -30) return "return-down-3";
  return "return-down-4";
}

export function makeAssetMaps(dataset) {
  return Object.fromEntries(
    ASSETS.map(({ symbol }) => [
      symbol,
      new Map((dataset.assets?.[symbol]?.rows || []).map((row) => [row.monthKey, row])),
    ]),
  );
}

export function metricValue(assetRow, btcRow, metric) {
  if (!assetRow || !Number.isFinite(assetRow.pct)) return null;
  if (metric === "absolute") return assetRow.pct;
  if (!btcRow || !Number.isFinite(btcRow.pct)) return null;
  return assetRow.pct - btcRow.pct;
}

export function buildRotationRows(dataset, assetMaps, range, metric) {
  const monthKeys = [...new Set(ASSETS.flatMap(({ symbol }) => dataset.assets?.[symbol]?.rows?.map((row) => row.monthKey) || []))]
    .sort()
    .reverse();
  const selectedKeys = range === "all" ? monthKeys : monthKeys.slice(0, Number(range));

  return selectedKeys.map((monthKey) => {
    const btcRow = assetMaps.BTC.get(monthKey);
    const cells = Object.fromEntries(
      ASSETS.map(({ symbol }) => {
        const row = assetMaps[symbol].get(monthKey) || null;
        return [symbol, { row, value: metricValue(row, btcRow, metric) }];
      }),
    );
    const ranked = ASSETS
      .map(({ symbol }) => ({ symbol, value: cells[symbol].value }))
      .filter((item) => Number.isFinite(item.value))
      .sort((a, b) => b.value - a.value);
    return {
      monthKey,
      year: Number(monthKey.slice(0, 4)),
      cells,
      leader: ranked[0]?.symbol || null,
      ranking: ranked,
      cycle: cycleForYear(Number(monthKey.slice(0, 4))),
    };
  });
}

function annualReturn(months) {
  const available = months.filter((month) => month?.row && Number.isFinite(month.row.open) && Number.isFinite(month.row.close));
  if (!available.length) return null;
  const first = available[0].row;
  const last = available[available.length - 1].row;
  return first.open === 0 ? null : ((last.close - first.open) / first.open) * 100;
}

export function buildCycleYears(dataset, assetMaps, asset, metric) {
  const assetRows = dataset.assets?.[asset]?.rows || [];
  const firstYear = assetRows.length ? Math.max(CYCLE_START_YEAR, Number(assetRows[0].monthKey.slice(0, 4))) : new Date().getUTCFullYear();
  const currentYear = Number(dataset.currentMonthKey?.slice(0, 4)) || new Date().getUTCFullYear();
  const endYear = currentYear + 1;
  const years = [];

  for (let year = endYear; year >= firstYear; year -= 1) {
    const months = MONTH_LABELS.map((_, monthIndex) => {
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const row = assetMaps[asset].get(monthKey) || null;
      const btcRow = assetMaps.BTC.get(monthKey) || null;
      return { monthKey, row, btcRow, value: metricValue(row, btcRow, metric) };
    });
    const assetAnnual = annualReturn(months);
    const btcMonths = months.map((month) => ({ row: month.btcRow }));
    const btcAnnual = annualReturn(btcMonths);
    let totalValue = assetAnnual;
    if (metric === "relative") {
      if (!Number.isFinite(assetAnnual) || !Number.isFinite(btcAnnual)) totalValue = null;
      else totalValue = ((1 + assetAnnual / 100) / (1 + btcAnnual / 100) - 1) * 100;
    }
    years.push({ year, months, totalValue, cycle: cycleForYear(year) });
  }
  return years;
}

export function monthlyStats(years) {
  const values = Array.from({ length: 12 }, () => []);
  for (const year of years) {
    year.months.forEach((month, index) => {
      if (Number.isFinite(month.value)) values[index].push(month.value);
    });
  }
  const average = values.map((items) => items.length ? items.reduce((sum, item) => sum + item, 0) / items.length : null);
  const median = values.map((items) => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  });
  return { average, median };
}

export function freshnessLabel(iso, language = "zh") {
  const timestamp = new Date(iso);
  if (Number.isNaN(timestamp.getTime())) {
    if (language === "en") return "Update time unknown";
    return "\u66f4\u65b0\u65f6\u95f4\u672a\u77e5";
  }
  const locale = language === "en" ? "en-US" : "zh-CN";
  const timeZone = language === "en" ? "America/New_York" : "Asia/Shanghai";
  const zoneLabel = language === "en" ? "ET" : "UTC+8";
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
  if (language === "en") return `Data through ${formatted} ${zoneLabel}`;
  return `\u6570\u636e\u622a\u81f3 ${formatted} ${zoneLabel}`;
}
