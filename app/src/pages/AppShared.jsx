import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ASSETS,
  HALVING_MONTHS,
  appHashUrl,
  appUrl,
  buildCycleYears,
  buildRotationRows,
  delayLabel,
  formatPct,
  formatPrice,
  freshnessLabel,
  isCycleGroupStartYear,
  makeAssetMaps,
  monthlyStats,
  routePathname,
  returnClass,
} from "../data.js";
import { useLiveData } from "../useLiveData.js";
import {
  chipCategoryRows,
  chipPendingAssets,
  chipTopMovers,
  isChipSampleAsset,
} from "../chipData.js";

export const FIVE_MINUTES_MS = 300_000;
export const MACRO_LIVE_DATA = [
  { id: "macroCalendar", path: "data/macro-calendar.json", pollIntervalMs: FIVE_MINUTES_MS },
];
export const EQUITY_SUMMARY_LIVE_DATA = [
  { id: "equityWeekly", path: "data/equity-weekly.json", pollIntervalMs: FIVE_MINUTES_MS },
  { id: "equityFast", path: "data/equity-fast.json", pollIntervalMs: 60_000, required: false },
];
export const EQUITY_CHART_LIVE_DATA = [
  { id: "chartSeries", path: "data/chart-series.json", pollIntervalMs: FIVE_MINUTES_MS, required: false },
];
export const MARKET_CLOCK_LIVE_DATA = [
  { id: "marketSession", path: "data/market-session.json", pollIntervalMs: FIVE_MINUTES_MS },
];
export const CRYPTO_LIVE_DATA = [
  { id: "marketMonthly", path: "data/market-monthly.json", pollIntervalMs: FIVE_MINUTES_MS },
];
export const CHIP_CHAIN_LIVE_DATA = [
  { id: "chipChain", path: "data/chip-chain-hotspots.json", pollIntervalMs: FIVE_MINUTES_MS },
];
export const ROBOT_CHAIN_LIVE_DATA = [
  { id: "robotChain", path: "data/robot-chain-watchlist.json", pollIntervalMs: FIVE_MINUTES_MS },
];

export function useDeferredActivation(active) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!active) {
      setEnabled(false);
      return undefined;
    }
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(() => setEnabled(true), { timeout: 1_500 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(() => setEnabled(true), 100);
    return () => window.clearTimeout(timeoutId);
  }, [active]);

  return enabled;
}

export const DEFAULT_CRYPTO_STATE = {
  view: "cycle",
  metric: "absolute",
  range: "48",
  asset: "BTC",
};

export const DEFAULT_EQUITY_STATE = {
  range: "52",
};

export const DEFAULT_MACRO_STATE = {
  category: "all",
};

export const DEFAULT_CHIP_CHAIN_STATE = {
  range: "1d",
};

export const DEFAULT_ROBOT_CHAIN_STATE = {
  range: "1d",
};

export const VALID_CRYPTO_VIEWS = new Set(["rotation", "cycle"]);
export const VALID_CRYPTO_METRICS = new Set(["absolute", "relative"]);
export const VALID_CRYPTO_RANGES = new Set(["12", "24", "48", "all"]);
export const VALID_ASSETS = new Set(ASSETS.map((asset) => asset.symbol));
export const VALID_EQUITY_RANGES = new Set(["26", "52", "all"]);
export const VALID_MACRO_CATEGORIES = new Set(["all", "inflation", "growth", "rates", "volatility", "liquidity", "other"]);
export const VALID_CHIP_CHAIN_RANGES = new Set(["1d", "5d", "1m", "3m"]);
export const VALID_ROBOT_CHAIN_RANGES = new Set(["1d", "5d", "1m", "3m"]);
export const ADMIN_PAGE_ENABLED = import.meta.env.DEV;

export const MACRO_CALENDAR_TIME_ZONES = {
  zh: "Asia/Shanghai",
  en: "America/New_York",
};

export const EQUITY_MARKET_TEXT = {
  zh: {
    eyebrow: "EQUITY MARKET MAP",
    titleAccent: "\u7f8e\u80a1\u5927\u76d8",
    titleRest: "\u65e5\u5386",
    subtitle: "\u7528\u65e5\u9891\u4ef7\u683c\u3001\u5229\u7387\u548c\u6ce2\u52a8\u7387\u89c2\u5bdf\u98ce\u9669\u8d44\u4ea7\u7684\u77ed\u671f\u73af\u5883",
    cache: "\u5e02\u573a\u7f13\u5b58",
    cacheTooltip: "\u9875\u9762\u53ea\u8bfb\u53d6\u540e\u53f0\u751f\u6210\u7684\u9759\u6001\u7f13\u5b58\u3002\u7edf\u8ba1\u5361\u4f18\u5148\u8bfb\u53d6 15 \u5206\u949f\u76ee\u6807\u5237\u65b0\u7684\u5feb\u7f13\u5b58\uff1b\u5468\u5386\u548c\u6708\u5386\u7ee7\u7eed\u8bfb\u53d6\u6162\u7f13\u5b58\u3002\u524d\u7aef\u4e0d\u76f4\u8fde\u884c\u60c5\u6e90\u3002",
    success: "\u5e02\u573a\u6570\u636e\u5df2\u66f4\u65b0",
    failure: (count) => `\u6570\u636e\u6e90\u5f02\u5e38\uff1a${count}`,
    loading: "\u6b63\u5728\u8bfb\u53d6\u672c\u5730\u5e02\u573a\u7f13\u5b58\u2026",
    unavailable: "\u7f8e\u80a1\u5927\u76d8\u6570\u636e\u672a\u80fd\u52a0\u8f7d",
    latest: "\u6700\u65b0\u89c2\u6d4b",
    dow: "DOW",
    sox: "\u8d39\u57ce\u534a\u5bfc\u4f53",
    tenYear: "10Y",
    japanTenYear: "\u65e5\u672c10Y",
    japanTenYearCompact: "\u65e510Y",
    vix: "VIX",
    open: "\u5f00",
    currentPrice: "\u73b0\u4ef7",
    close: "\u6536",
    dayMove: "\u6da8\u8dcc",
    priceIndicators: "\u89c2\u5bdf\u6307\u6807",
    marketClosed: "\u7f8e\u80a1\u4f11\u5e02",
    macro: "\u5168\u7403\u5229\u7387 / \u6ce2\u52a8",
    usdCny: "USD/CNY",
    btcMarketCap: "BTC\u5e02\u503c",
    cryptoMarketCap: "\u52a0\u5bc6\u603b\u5e02\u503c",
    goldProxy: "\u9ec4\u91d1\u6307\u6570",
    waitingForFastData: "\u7b49\u5f85\u5feb\u7f13\u5b58",
    compareKicker: "\u6307\u6807\u6d3b\u52a8\u56fe\u8868",
    compareTitle: "\u81ea\u5b9a\u4e49\u53cc\u8f74\u5bf9\u6bd4",
    compareSubtitle: "\u4ece\u9759\u6001\u6d3e\u751f\u7f13\u5b58\u8bfb\u53d6\u5386\u53f2\u70b9\uff0c\u5de6\u53f3 Y \u8f74\u53ef\u5206\u522b\u9009\u62e9\u6307\u6807\u3002",
    leftAxis: "\u5de6\u8f74",
    rightAxis: "\u53f3\u8f74",
    noRightAxis: "\u4e0d\u4f7f\u7528\u53f3\u8f74",
    xWindow: "X \u8f74",
    transform: "\u53d8\u6362",
    yZoom: "Y \u7f29\u653e",
    reset: "\u91cd\u7f6e",
    chartLoading: "\u6b63\u5728\u8bfb\u53d6\u6307\u6807\u56fe\u8868\u7f13\u5b58\u2026",
    chartUnavailable: "\u6307\u6807\u56fe\u8868\u7f13\u5b58\u6682\u4e0d\u53ef\u7528",
    chartInsufficient: "\u5f53\u524d\u7a97\u53e3\u5185\u81f3\u5c11\u9700\u8981 2 \u4e2a\u89c2\u6d4b\u70b9\u624d\u80fd\u753b\u7ebf\u3002",
    points: "\u70b9",
    source: "\u6765\u6e90",
    latestPoint: "\u6700\u65b0",
    weekCalendarTitle: "\u672c\u5468\u8be6\u60c5",
    monthCalendarTitle: "\u6708\u5ea6\u6982\u89c8",
    currentWeek: "\u672c\u5468",
    currentMonth: "\u672c\u6708",
    previousWeek: "\u4e0a\u5468",
    nextWeek: "\u4e0b\u5468",
    previousMonth: "\u4e0a\u6708",
    nextMonth: "\u4e0b\u6708",
    priceSourceNote: "\u4ef7\u683c\u6765\u81ea AKShare/Sina \u7f8e\u80a1\u65e5\u7ebf\uff0cDOW \u4f7f\u7528 DIA ETF \u4ee3\u7406\uff0c\u8d39\u57ce\u534a\u5bfc\u4f53\u6307\u6570\u4f7f\u7528 yfinance ^SOX \u5ef6\u8fdf\u65e5\u7ebf\uff1b10Y\u3001VIX\u3001USD/CNY \u548c\u9ec4\u91d1\u6307\u6570\u4ee3\u7406\u6765\u81ea FRED\uff0c\u52a0\u5bc6\u5e02\u503c\u6765\u81ea CMC\u3002\u524d\u7aef\u53ea\u8bfb\u53d6\u9759\u6001\u7f13\u5b58\u3002",
    methodology: "\u65e5\u5386\u884c\u5408\u5e76\u7f13\u5b58\u7684 QQQ/SPY/DIA/SOX \u65e5\u7ebf OHLC \u4e0e FRED 10Y/VIX/USD-CNY \u89c2\u6d4b\uff1b\u9876\u90e8\u5feb\u5361\u6765\u81ea\u5355\u72ec\u7684\u5feb\u7f13\u5b58\u3002",
    eventPlaceholder: "\u52a0\u5bc6\u4f9b\u7ed9\u4e0e CEX \u5468\u5e74\u4e8b\u4ef6\u662f\u6d41\u52a8\u6027\u89c2\u5bdf\u951a\u70b9\uff0c\u4e0d\u4ee3\u8868\u4fdd\u8bc1\u53d1\u751f\u7684\u4ef7\u683c\u51b2\u51fb\u3002",
  },
  en: {
    eyebrow: "EQUITY MARKET MAP",
    titleAccent: "US Market",
    titleRest: "Calendar",
    subtitle: "Daily price, rates, and volatility context for short-term risk-asset conditions.",
    cache: "Market cache",
    cacheTooltip: "The page reads generated static caches. Summary cards prefer the fast cache with a 15-minute target cadence; calendars keep using the slower cache. The frontend never connects directly to market-data providers.",
    success: "Market data updated",
    failure: (count) => `Source issues: ${count}`,
    loading: "Reading local market cache...",
    unavailable: "Equity market data could not be loaded",
    latest: "Latest observation",
    dow: "DOW",
    sox: "PHLX SOX",
    tenYear: "10Y",
    japanTenYear: "Japan 10Y",
    japanTenYearCompact: "JP10Y",
    vix: "VIX",
    open: "Open",
    currentPrice: "Current",
    close: "Close",
    dayMove: "Move",
    priceIndicators: "Observations",
    marketClosed: "Market closed",
    macro: "Global rates / volatility",
    usdCny: "USD/CNY",
    btcMarketCap: "BTC cap",
    cryptoMarketCap: "Crypto cap",
    goldProxy: "Gold proxy",
    waitingForFastData: "Waiting for fast cache",
    compareKicker: "INTERACTIVE SERIES",
    compareTitle: "Custom dual-axis comparison",
    compareSubtitle: "Reads historical points from the derived static cache; choose one metric for each Y axis.",
    leftAxis: "Left axis",
    rightAxis: "Right axis",
    noRightAxis: "No right axis",
    xWindow: "X axis",
    transform: "Transform",
    yZoom: "Y zoom",
    reset: "Reset",
    chartLoading: "Reading chart-series cache...",
    chartUnavailable: "Chart-series cache is not available",
    chartInsufficient: "This window needs at least two observations to draw a line.",
    points: "pts",
    source: "Source",
    latestPoint: "Latest",
    weekCalendarTitle: "This week details",
    monthCalendarTitle: "Monthly overview",
    currentWeek: "This week",
    currentMonth: "This month",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    previousMonth: "Previous",
    nextMonth: "Next",
    priceSourceNote: "Prices use AKShare/Sina U.S. daily data; DOW uses DIA as an ETF proxy and PHLX SOX uses delayed yfinance ^SOX daily data. 10Y, VIX, USD/CNY, and the gold proxy use FRED; crypto market caps use CMC. The frontend reads static cache only.",
    methodology: "Calendar rows combine cached QQQ/SPY/DIA/SOX daily OHLC with FRED 10Y/VIX/USD-CNY observations; summary cards use a separate fast cache.",
    eventPlaceholder: "Crypto-supply and CEX-anniversary entries are liquidity-monitoring anchors, not guaranteed price-impact events.",
  },
};

export function equityCopy(t) {
  return t.htmlLang === "zh-CN" ? EQUITY_MARKET_TEXT.zh : EQUITY_MARKET_TEXT.en;
}

export const MARKET_CLOCK_TEXT = {
  zh: {
    docTitle: "全球市场开市轮动",
    docDescription: "加密、美股、韩股与中国风险市场的开市状态、价格和市值轮动视图",
    eyebrow: "GLOBAL MARKET CLOCK",
    titleAccent: "全球市场",
    titleRest: "开市轮动",
    subtitle: "用开市状态、代理价格和数据质量提示感知中美韩与加密风险市场的日内轮动",
    cache: "市场快照",
    cacheTooltip: "页面只读取后台生成的 market-session.json；官方交易日历和下一状态切换时间已由后端展开为绝对时间段，密钥不会进入浏览器。",
    success: "市场快照已更新",
    failure: (count) => `数据源提示：${count}`,
    loading: "正在读取市场快照…",
    unavailable: "市场轮动数据未能加载",
    controls: "市场轮动控制",
    showCrypto: "显示加密",
    hideCrypto: "隐藏加密",
    cryptoHidden: "加密市场已隐藏",
    marketState: "市场状态",
    assetList: "轮动列表",
    details: "标的细节",
    localTime: "本地时间",
    next: "下一阶段",
    sessions: "交易时段",
    alwaysOpen: "24小时交易",
    sourceNote: "价格优先使用公开行情快照；美股和 CL 可使用 OKX 合约/指数代理，旁边会标注数据质量。",
    methodology: "\u540e\u7aef\u4f7f\u7528 NYSE\u3001KRX \u548c\u4e0a\u4ea4\u6240\u5b98\u65b9\u65e5\u5386\u751f\u6210\u7edd\u5bf9\u65f6\u95f4\u72b6\u6001\u6bb5\uff0c\u5305\u62ec\u8282\u5047\u65e5\u3001\u63d0\u524d\u6536\u5e02\u3001\u5468\u672b\u548c\u4e0b\u4e00\u72b6\u6001\u5207\u6362\u65f6\u95f4\uff1b\u524d\u7aef\u53ea\u5339\u914d\u5f53\u524d\u65f6\u95f4\u6bb5\u5e76\u663e\u793a\u5012\u8ba1\u65f6\u3002",
    status: {
      open: "盘中",
      trading: "交易中",
      premarket: "盘前",
      night: "\u591c\u76d8",
      openingAuction: "集合竞价",
      closingAuction: "收盘集合竞价",
      afterhours: "盘后",
      lunch: "午间休市",
      closed: "休市",
      soon: "即将开市",
    },
    table: {
      market: "市场",
      asset: "标的",
      status: "状态",
      price: "现价",
      change: "涨幅",
      marketCap: "总市值",
      source: "数据质量",
      noRows: "暂无可显示标的",
    },
    detail: {
      emptyTitle: "查看数据质量",
      emptyBody: "点击任意标的，可查看价格来源、更新时间、市值来源和代理价格说明。",
      selected: "已选标的",
      pair: "显示单位",
      priceSource: "价格来源",
      capSource: "市值来源",
      updated: "更新时间",
      components: "指数成分",
      quality: "提示",
    },
    sourcePending: "待接入",
    notApplicable: "不适用",
    unavailableValue: "N/A",
  },
  en: {
    docTitle: "Global Market Rotation Clock",
    docDescription: "Session status, prices, and market caps for crypto, U.S., Korean, and China risk markets.",
    eyebrow: "GLOBAL MARKET CLOCK",
    titleAccent: "Global Market",
    titleRest: "Rotation",
    subtitle: "Track intraday session rotation across crypto, U.S., Korea, and China risk markets with source-quality hints.",
    cache: "Market snapshot",
    cacheTooltip: "The page reads generated market-session.json only. The backend expands official exchange calendars and next-transition boundaries into absolute intervals; credentials never reach the browser.",
    success: "Market snapshot updated",
    failure: (count) => `Source notes: ${count}`,
    loading: "Reading market snapshot...",
    unavailable: "Market rotation data could not be loaded",
    controls: "Market rotation controls",
    showCrypto: "Show crypto",
    hideCrypto: "Hide crypto",
    cryptoHidden: "Crypto market hidden",
    marketState: "Market state",
    assetList: "Rotation list",
    details: "Asset detail",
    localTime: "Local time",
    next: "Next phase",
    sessions: "Sessions",
    alwaysOpen: "24/7 trading",
    sourceNote: "Prices use public market snapshots where available; U.S. equities and CL may use clearly labeled OKX proxy contracts or index prices.",
    methodology: "The backend expands reviewed NYSE, KRX, and SSE calendars into absolute status intervals covering exchange holidays, early closes, weekends, and next-transition times. The frontend only selects the current interval and renders the countdown.",
    status: {
      open: "Open",
      trading: "Trading",
      premarket: "Pre-market",
      night: "Night session",
      openingAuction: "Call auction",
      closingAuction: "Closing auction",
      afterhours: "After-hours",
      lunch: "Lunch recess",
      closed: "Closed",
      soon: "Opening soon",
    },
    table: {
      market: "Market",
      asset: "Asset",
      status: "Status",
      price: "Price",
      change: "Change",
      marketCap: "Market cap",
      source: "Quality",
      noRows: "No visible assets",
    },
    detail: {
      emptyTitle: "Inspect data quality",
      emptyBody: "Select any asset to see price source, update time, market-cap source, and proxy-price notes.",
      selected: "Selected asset",
      pair: "Display unit",
      priceSource: "Price source",
      capSource: "Cap source",
      updated: "Updated",
      components: "Index components",
      quality: "Note",
    },
    sourcePending: "Pending",
    notApplicable: "N/A",
    unavailableValue: "N/A",
  },
};

export const MARKET_CLOCK_LIMITS = {
  zh: {
    kicker: "\u4ea4\u6613\u9636\u6bb5\u7ea6\u675f",
    title: "\u975e\u52a0\u5bc6\u5e02\u573a\u5f00\u5e02\u9636\u6bb5\u9650\u5236",
    note: "\u8fd9\u91cc\u5217\u51fa\u7684\u662f\u73b0\u91d1\u80a1\u7968\u5e02\u573a\u7684\u884c\u4e1a\u6027\u7ea6\u675f\uff0c\u7528\u4e8e\u89e3\u91ca\u201c\u5f00\u5e02\u201d\u4e0d\u7b49\u4e8e\u4efb\u610f\u65f6\u6bb5\u90fd\u6709\u6df1\u5ea6\u3001\u5168\u90e8\u8ba2\u5355\u7c7b\u578b\u548c\u53ef\u6bd4\u4ef7\u683c\u3002",
    introLines: [
      "\u8fd9\u91cc\u5217\u51fa\u7684\u662f\u73b0\u91d1\u80a1\u7968\u5e02\u573a\u7684\u884c\u4e1a\u6027\u7ea6\u675f\u3002",
      "\u7528\u4e8e\u89e3\u91ca\u201c\u5f00\u5e02\u201d\u4e0d\u7b49\u4e8e\u4efb\u610f\u65f6\u6bb5\u90fd\u6709\u6df1\u5ea6\u3001\u5168\u90e8\u8ba2\u5355\u7c7b\u578b\u548c\u53ef\u6bd4\u4ef7\u683c\u3002",
    ],
    sourcesLabel: "\u89c4\u5219\u53c2\u8003",
    sources: "NYSE / KRX / SSE / SZSE \u516c\u5f00\u4ea4\u6613\u65f6\u6bb5\u4e0e\u4ea4\u6613\u89c4\u5219\u3002",
    markets: [
      {
        market: "\u7f8e\u56fd\u80a1\u5e02",
        summary: "\u6838\u5fc3\u76d8\u4e3a 09:30-16:00 ET\u3002\u76d8\u524d\u76d8\u540e\u662f\u5ef6\u957f\u4ea4\u6613\uff1b\u9875\u9762\u4e2d\u7684\u591c\u76d8\u4e0d\u7b49\u540c\u4e8e\u4e3b\u6d41\u4ea4\u6613\u6240\u73b0\u91d1\u80a1\u7968\u6838\u5fc3\u76d8\u3002",
        sessions: [
          ["\u591c\u76d8", "\u4e0d\u662f\u4e3b\u6d41\u4ea4\u6613\u6240\u73b0\u91d1\u80a1\u7968\u7684\u884c\u4e1a\u901a\u7528\u6838\u5fc3\u65f6\u6bb5\uff1b\u82e5\u6709\u9694\u591c\u80a1\u7968\u8bbf\u95ee\uff0c\u901a\u5e38\u4f9d\u8d56\u5238\u5546\u3001ATS \u6216\u4ee3\u7406\u5408\u7ea6\uff0c\u6d41\u52a8\u6027\u3001\u6807\u7684\u548c\u8ba2\u5355\u7c7b\u578b\u5747\u53d7\u9650\u3002"],
          ["\u76d8\u524d", "\u5c5e\u4e8e\u5ef6\u957f\u4ea4\u6613\uff0c\u53c2\u4e0e\u8005\u66f4\u5c11\u3001\u4ef7\u5dee\u53ef\u80fd\u66f4\u5bbd\uff1b\u53ef\u4ea4\u6613\u6807\u7684\u3001\u8ba2\u5355\u7c7b\u578b\u548c\u662f\u5426\u80fd\u6210\u4ea4\u53d6\u51b3\u4e8e\u573a\u6240\u548c\u5238\u5546\u3002"],
          ["\u76d8\u4e2d", "\u8fd9\u662f\u4e3b\u8981\u8fde\u7eed\u4ea4\u6613\u65f6\u6bb5\uff0c\u5f00\u76d8\u548c\u6536\u76d8\u5468\u8fb9\u6709\u96c6\u5408\u7ade\u4ef7\u6216\u4e0d\u5e73\u8861\u51bb\u7ed3\u89c4\u5219\uff0c\u5e02\u573a\u6df1\u5ea6\u548c\u4ef7\u683c\u53d1\u73b0\u901a\u5e38\u6700\u5177\u53ef\u6bd4\u6027\u3002"],
          ["\u76d8\u540e", "\u5c5e\u4e8e\u5ef6\u957f\u4ea4\u6613\uff0c\u5e76\u975e\u6240\u6709\u80a1\u7968\u3001\u8ba2\u5355\u6216\u6295\u8d44\u8005\u90fd\u4ee5\u76f8\u540c\u6761\u4ef6\u53c2\u4e0e\uff1b\u5ef6\u540e\u65f6\u6bb5\u7684\u4ef7\u683c\u4e0d\u4e00\u5b9a\u4ee3\u8868\u6b21\u65e5\u5e38\u89c4\u5f00\u76d8\u4ef7\u3002"],
        ],
      },
      {
        market: "\u97e9\u56fd\u80a1\u5e02",
        summary: "\u73b0\u91d1\u80a1\u7968\u6b63\u5e38\u76d8\u4e3a 09:00-15:30 KST\uff0c\u5171 6.5 \u5c0f\u65f6\uff1b\u542b\u76d8\u524d\u548c\u76d8\u540e\u7684\u53ef\u4ea4\u6613\u7a97\u53e3\u7ea6 10 \u5c0f\u65f6 20 \u5206\uff0c\u4f46\u4e0d\u5b58\u5728\u7c7b\u4f3c\u7f8e\u80a1\u5ef6\u957f\u4ea4\u6613\u7684\u73b0\u91d1\u80a1\u7968\u591c\u76d8\u3002",
        sessions: [
          ["\u65e0\u591c\u76d8", "\u97e9\u80a1\u73b0\u91d1\u80a1\u7968\u6ca1\u6709\u4e3b\u6d41\u4ea4\u6613\u6240\u901a\u7528\u7684\u9694\u591c\u8fde\u7eed\u4ea4\u6613\u65f6\u6bb5\uff1b\u884d\u751f\u54c1\u6216\u6d77\u5916\u4ee3\u7406\u4ea7\u54c1\u82e5\u6709\u591c\u76d8\uff0c\u4e0d\u7b49\u4e8e KOSPI/KOSDAQ \u73b0\u91d1\u80a1\u7968\u3002"],
          ["\u76d8\u524d", "\u5c5e\u4e8e\u79bb\u6563\u4ea4\u6613\u7a97\u53e3\uff0c\u4e0d\u662f\u5e38\u89c4\u8fde\u7eed\u7ade\u4ef7\uff1b\u76d8\u524d/\u76d8\u540e\u6536\u76d8\u4ef7\u4ea4\u6613\u9636\u6bb5\u4e0d\u63a5\u53d7\u5e02\u4ef7\u5355\u3001FOK \u6216 IOC \u6761\u4ef6\u5355\u3002"],
          ["\u76d8\u4e2d", "\u4e3b\u8981\u4e3a\u8fde\u7eed\u7ade\u4ef7\uff0c\u5f00\u76d8/\u6536\u76d8\u6709\u5b9a\u65f6\u96c6\u5408\u7ade\u4ef7\uff1b\u80a1\u7968\u65e5\u6da8\u8dcc\u5e45\u9650\u5236\u901a\u5e38\u4e3a\u57fa\u51c6\u4ef7\u7684 \u00b130%\u3002"],
          ["\u76d8\u540e", "\u5148\u6709\u6536\u76d8\u4ef7\u4ea4\u6613\uff0c\u540e\u6709\u5b9a\u65f6\u96c6\u5408\u7ade\u4ef7\uff1b\u4e0d\u662f\u81ea\u7531\u8fde\u7eed\u4ea4\u6613\uff0c\u5927\u5b97/\u7bee\u5b50\u4ea4\u6613\u8fd8\u6709\u6700\u4f4e\u6570\u91cf\u6216\u91d1\u989d\u95e8\u69db\u3002"],
        ],
      },
      {
        market: "\u4e2d\u56fd A \u80a1",
        summary: "\u4e0a\u6df1\u4e3b\u6d41\u73b0\u91d1\u80a1\u7968\u4e3a\u65e5\u5185\u96c6\u5408\u7ade\u4ef7+\u5206\u6bb5\u8fde\u7eed\u7ade\u4ef7\uff0c\u6709\u5348\u95f4\u4f11\u5e02\uff0c\u666e\u904d\u4e0d\u5b58\u5728\u73b0\u91d1\u80a1\u7968\u591c\u76d8\u3002",
        sessions: [
          ["\u5f00\u76d8\u96c6\u5408\u7ade\u4ef7", "09:15-09:25 \u4e3a\u5f00\u76d8\u96c6\u5408\u7ade\u4ef7\uff0c\u6309\u6700\u5927\u6210\u4ea4\u91cf\u7b49\u539f\u5219\u5f62\u6210\u5f00\u76d8\u4ef7\uff1b\u4e0d\u662f\u8fde\u7eed\u6210\u4ea4\u3002"],
          ["\u76d8\u4e2d", "09:30-11:30 \u548c 13:00-14:57 \u4e3a\u8fde\u7eed\u7ade\u4ef7\uff0c\u4e2d\u95f4\u5348\u4f11\uff1b\u591a\u6570\u80a1\u7968\u4ecd\u6709\u6da8\u8dcc\u5e45\u9650\u5236\uff0c\u4e14\u666e\u901a A \u80a1\u5e76\u4e0d\u5b9e\u884c\u65e5\u5185 T+0 \u56de\u8f6c\u4ea4\u6613\u3002"],
          ["\u6536\u76d8\u96c6\u5408\u7ade\u4ef7", "14:57-15:00 \u4e3a\u6536\u76d8\u96c6\u5408\u7ade\u4ef7\uff0c\u7528\u4e8e\u5f62\u6210\u6536\u76d8\u4ef7\uff1b\u5f53\u524d\u9636\u6bb5\u7684\u6210\u4ea4\u65b9\u5f0f\u4e0e\u8fde\u7eed\u7ade\u4ef7\u4e0d\u540c\u3002"],
          ["\u76d8\u540e", "\u4e3b\u677f\u73b0\u91d1\u80a1\u7968\u901a\u5e38\u6ca1\u6709\u9762\u5411\u666e\u901a\u8fde\u7eed\u7ade\u4ef7\u7684\u76d8\u540e\u7a97\u53e3\uff1b\u79d1\u521b\u677f/\u521b\u4e1a\u677f\u7b49\u677f\u5757\u6216\u5927\u5b97\u4ea4\u6613\u53ef\u80fd\u5b58\u5728\u76d8\u540e\u5b9a\u4ef7\u6216\u786e\u8ba4\u7a97\u53e3\uff0c\u8303\u56f4\u548c\u95e8\u69db\u53d7\u9650\u3002"],
        ],
      },
    ],
  },
  en: {
    kicker: "TRADING PHASE LIMITS",
    title: "Non-Crypto Market Phase Limits",
    note: "These are market-wide cash-equity constraints for mainstream venues, meant to explain that open status does not always mean deep liquidity, all order types, or regular-session price discovery.",
    introLines: [
      "These are market-wide cash-equity constraints for mainstream venues.",
      "They explain why open status does not always mean deep liquidity, all order types, or regular-session price discovery.",
    ],
    sourcesLabel: "Rule references",
    sources: "NYSE / KRX / SSE / SZSE public trading hours and trading rules.",
    markets: [
      {
        market: "U.S. equities",
        summary: "Core cash-equity trading is 9:30 a.m.-4:00 p.m. ET. Pre-market and after-hours are extended trading; the page's night phase should not be read as the mainstream exchange core cash-equity session.",
        sessions: [
          ["Night", "Not a mainstream-exchange cash-equity core session. Overnight stock access, when available, usually depends on broker, ATS, or proxy products, with limited liquidity, symbols, and order types."],
          ["Pre-market", "Extended-hours trading has fewer participants and can have wider spreads. Eligible symbols, order types, and execution depend on venue and broker access."],
          ["Regular", "The primary continuous session, with opening and closing auctions around the boundaries. Market depth and price discovery are usually most comparable here."],
          ["After-hours", "Extended-hours trading is not available for every security, order type, or investor on equal terms. Late-session prices may not represent the next regular open."],
        ],
      },
      {
        market: "Korea equities",
        summary: "KRX cash equities trade 9:00 a.m.-3:30 p.m. KST in the regular session, or 6.5 hours. Including pre- and after-hours windows gives about 10h20m of tradable windows, but Korea cash equities do not have a U.S.-style overnight session.",
        sessions: [
          ["No night", "Mainstream KOSPI/KOSDAQ cash equities do not have an overnight continuous session. Derivatives or overseas proxy products are not the same as local cash-equity trading."],
          ["Pre-hours", "An off-hours window, not the regular continuous auction. Pre/after-hours closing-price trade does not accept market, FOK, or IOC orders."],
          ["Regular", "Mainly continuous auction, with opening and closing call auctions. Daily price limits for stocks are generally +/-30% of the base price."],
          ["After-hours", "Closing-price trading is followed by periodic call auction. It is not free continuous trading; block/basket trades also have minimum size or value thresholds."],
        ],
      },
      {
        market: "China A-shares",
        summary: "Mainland cash equities use call auction plus split continuous-auction sessions with a lunch break. Mainstream cash equities generally do not have an overnight session.",
        sessions: [
          ["Opening call", "9:15-9:25 is call auction. The opening price is formed by call-auction principles rather than continuous matching."],
          ["Regular", "9:30-11:30 and 13:00-14:57 are continuous auction with a lunch break. Most stocks still have price limits, and ordinary A-shares generally do not allow same-day T+0 turnaround trading."],
          ["Closing call", "14:57-15:00 is closing call auction, a distinct mechanism for forming the close rather than regular continuous matching."],
          ["After-hours", "Main Board cash equities generally do not have a broad public continuous after-hours session. STAR/ChiNext-style boards or block trades may have fixed-price or confirmation windows with scope and threshold limits."],
        ],
      },
    ],
  },
};

export function marketClockCopy(t) {
  const language = t.htmlLang === "zh-CN" ? "zh" : "en";
  return {
    ...MARKET_CLOCK_TEXT[language],
    tradingLimits: MARKET_CLOCK_LIMITS[language],
  };
}

export const CHIP_CHAIN_TEXT = {
  zh: {
    docTitle: "AI 芯片产业链热点",
    docDescription: "按产业链细分类目追踪 AI 芯片相关美股和韩股的板块轮动热点",
    eyebrow: "AI CHIP CHAIN",
    titleAccent: "AI 芯片",
    titleRest: "产业链热点",
    subtitle: "用细分类目、股票代码和相对强弱观察存储、光模块、设备、服务器和终端应用的轮动节奏",
    cache: "静态行情缓存",
    cacheTooltip: "当前页面读取后端/CI 脚本生成的静态行情 JSON；前端不直连行情源。",
    success: "产业链行情缓存已加载",
    failure: (count) => `信源提示：${count}`,
    loading: "正在读取产业链行情缓存…",
    unavailable: "AI 芯片产业链数据未能加载",
    controls: "产业链热点控制",
    range: "观察周期",
    latest: "当前热点",
    boardKicker: "CHAIN ROTATION BOARD",
    boardTitle: "产业链热力板",
    boardMethod: "类目涨幅为可见标的等权平均；颜色越深代表所选周期内越强。",
    detailEmptyTitle: "查看股票详情",
    detailEmptyBody: "点击任意股票代码，查看产业链角色、缓存价格、各周期涨跌、相对强弱和计划信源。",
    selected: "已选股票",
    category: "所属模块",
    role: "产业链角色",
    price: "缓存价格",
    returns: "涨跌幅",
    relative: "相对强弱",
    volume: "成交量放大",
    week52: "52 周位置",
    marketCap: "市值",
    source: "来源",
    sourceNote: "当前版本读取后端/CI 生成的静态行情缓存；简要 K 线只在标的存在真实 pricePaths 时展示，缺失或样例来源不再生成替代走势。",
    sampleSource: "样例/待接入",
    cacheSource: "静态行情缓存",
    plannedSource: "计划信源",
    noRows: "当前筛选下暂无股票",
    excess: "超额",
    vsSoxx: "SOXX",
    vsQqq: "QQQ",
    pendingKicker: "PENDING INTEGRATIONS",
    pendingTitle: "\u5f85\u63a5\u5165\u89c2\u5bdf\u533a",
    pendingDescription: "\u6837\u4f8b\u548c\u5f85\u63a5\u5165\u6807\u7684\u4e0d\u53c2\u4e0e\u677f\u5757\u5747\u503c\u3001\u9886\u6da8\u6807\u7684\u6216\u70ed\u70b9\u6392\u884c\uff1b\u6b64\u5904\u4ec5\u4fdd\u7559\u63a5\u5165\u72b6\u6001\u4e0e\u6700\u540e\u6837\u4f8b\u65f6\u95f4\u3002",
    rankingMethod: "\u677f\u5757\u6da8\u5e45\u4ec5\u5bf9\u6b63\u5f0f\u884c\u60c5\u7f13\u5b58\u505a\u7b49\u6743\u5e73\u5747\uff1b\u6837\u4f8b\u4e0e\u5f85\u63a5\u5165\u6807\u7684\u9ed8\u8ba4\u6392\u9664\u3002",
    pendingAsOf: "\u6837\u4f8b\u65f6\u95f4",
    pendingQuality: "\u63a5\u5165\u72b6\u6001",
    stage: {
      Upstream: "上游",
      Middle: "中游",
      Downstream: "下游",
    },
  },
  en: {
    docTitle: "AI Chip Chain Hotspots",
    docDescription: "Track AI chip supply-chain rotation across U.S. and Korean equities by category.",
    eyebrow: "AI CHIP CHAIN",
    titleAccent: "AI Chip",
    titleRest: "Chain Hotspots",
    subtitle: "Track rotation across memory, optics, equipment, servers, infrastructure, and applications using category panels and tickers.",
    cache: "Static quote cache",
    cacheTooltip: "This page reads generated static JSON from local or CI scripts using reviewed market-data feeds; the frontend must not call providers directly.",
    success: "Chip-chain quote cache loaded",
    failure: (count) => `Source notes: ${count}`,
    loading: "Reading chip-chain quote cache...",
    unavailable: "AI chip-chain data could not be loaded",
    controls: "Chip-chain hotspot controls",
    range: "Window",
    latest: "Current hotspots",
    boardKicker: "CHAIN ROTATION BOARD",
    boardTitle: "Supply-chain heat board",
    boardMethod: "Category returns are equal-weighted from visible tickers. Deeper color means stronger performance in the selected window.",
    detailEmptyTitle: "Inspect a ticker",
    detailEmptyBody: "Select any ticker to see its role, cached price, multi-window returns, relative strength, and planned source.",
    selected: "Selected ticker",
    category: "Module",
    role: "Supply-chain role",
    price: "Cached price",
    returns: "Returns",
    relative: "Relative strength",
    volume: "Volume ratio",
    week52: "52-week position",
    marketCap: "Market cap",
    source: "Source",
    sourceNote: "This version reads backend/CI generated static quote caches. Mini charts render only real cached pricePaths; missing or sample-sourced paths are left blank instead of being generated.",
    sampleSource: "Sample/pending row",
    cacheSource: "Static quote cache",
    plannedSource: "Planned source",
    noRows: "No tickers for this filter",
    excess: "Excess",
    vsSoxx: "SOXX",
    vsQqq: "QQQ",
    pendingKicker: "PENDING INTEGRATIONS",
    pendingTitle: "Pending integration watchlist",
    pendingDescription: "Sample and pending tickers are excluded from category averages, leaders, and hotspot rankings. This area preserves only their integration status and last sample timestamp.",
    rankingMethod: "Category returns are equal-weighted from production quote caches only; sample and pending tickers are excluded by default.",
    pendingAsOf: "Sample as of",
    pendingQuality: "Integration status",
    stage: {
      Upstream: "Upstream",
      Middle: "Middle",
      Downstream: "Downstream",
    },
  },
};

export function chipChainCopy(t) {
  return t.htmlLang === "zh-CN" ? CHIP_CHAIN_TEXT.zh : CHIP_CHAIN_TEXT.en;
}

export const ROBOT_CHAIN_TEXT = {
  zh: {
    docTitle: "机器人产业链观察池",
    docDescription: "按机器人产业链板块追踪上市标的、业务定位、缓存价格和多周期涨跌幅。",
    eyebrow: "ROBOTICS CHAIN",
    titleAccent: "机器人产业链",
    titleRest: "观察池",
    subtitle: "按算力、感知、芯片、运动控制、自动驾驶、仓储服务、医疗、防务和 ETF 梳理机器人主题标的",
    cache: "静态行情缓存",
    cacheTooltip: "当前页面读取本地或 CI 生成的静态行情 JSON；前端不直连行情源。",
    success: "机器人产业链行情缓存已加载",
    failure: (count) => `信源提示：${count}`,
    loading: "正在读取机器人产业链行情缓存…",
    unavailable: "机器人产业链数据未能加载",
    controls: "机器人产业链控制",
    range: "观察周期",
    latest: "当前观察池热点",
    tableKicker: "ROBOTICS WATCHLIST",
    tableTitle: "机器人产业链上市标的观察池",
    tableMethod: "表格保留分组与业务定位；价格、涨跌幅和简要 K 线来自静态行情缓存，可用时使用真实 pricePaths。",
    sector: "板块",
    company: "公司 / 代码",
    business: "业务定位",
    marketCap: "市值 / 规模",
    attribute: "属性",
    price: "价格",
    change: "涨幅",
    sparkline: "简要 K 线",
    sourceNote: "注：市值来自参考图的约数；ETF 为主题基金，规模信息可简化展示。以上仅为信息整理，不构成投资建议。",
    sampleSource: "静态行情缓存",
    noRows: "当前筛选下暂无标的",
    attributeLabels: {
      core: "核心层",
      growth: "成长层",
      speculative: "投机层",
      etf: "ETF",
    },
  },
  en: {
    docTitle: "Robotics Chain Watchlist",
    docDescription: "Track robotics value-chain listed names by segment, business role, cached price, and multi-window returns.",
    eyebrow: "ROBOTICS CHAIN",
    titleAccent: "Robotics Chain",
    titleRest: "Watchlist",
    subtitle: "A robotics-theme watchlist across compute, perception, chips, motion control, autonomy, warehouse/service robots, medical robotics, defense, and ETFs.",
    cache: "Static quote cache",
    cacheTooltip: "This page reads static quote JSON generated by local or CI scripts; the frontend must not call market-data providers directly.",
    success: "Robotics-chain quote cache loaded",
    failure: (count) => `Source notes: ${count}`,
    loading: "Reading robotics-chain quote cache...",
    unavailable: "Robotics-chain data could not be loaded",
    controls: "Robotics-chain controls",
    range: "Window",
    latest: "Current watchlist movers",
    tableKicker: "ROBOTICS WATCHLIST",
    tableTitle: "Robotics Industry Listed-Name Watchlist",
    tableMethod: "The table keeps the grouping and business roles. Prices, returns, and sparklines come from the static quote cache and use real pricePaths when available.",
    sector: "Sector",
    company: "Company / Code",
    business: "Business role",
    marketCap: "Market cap / scale",
    attribute: "Layer",
    price: "Price",
    change: "Change",
    sparkline: "Mini chart",
    sourceNote: "Market caps are approximate values from the reference image. ETFs are thematic funds and scale is simplified. For information only, not investment advice.",
    sampleSource: "Static quote cache",
    noRows: "No tickers for this filter",
    attributeLabels: {
      core: "Core",
      growth: "Growth",
      speculative: "Speculative",
      etf: "ETF",
    },
  },
};

export function robotChainCopy(t) {
  return t.htmlLang === "zh-CN" ? ROBOT_CHAIN_TEXT.zh : ROBOT_CHAIN_TEXT.en;
}

export function hashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  const rawHash = window.location.hash.replace(/^#/, "");
  const queryIndex = rawHash.indexOf("?");
  return new URLSearchParams(queryIndex >= 0 ? rawHash.slice(queryIndex + 1) : "");
}

export function readCryptoStateFromHash() {
  const params = hashParams();
  const view = params.get("view");
  const metric = params.get("metric");
  const range = params.get("range");
  const asset = params.get("asset");
  return {
    view: VALID_CRYPTO_VIEWS.has(view) ? view : DEFAULT_CRYPTO_STATE.view,
    metric: VALID_CRYPTO_METRICS.has(metric) ? metric : DEFAULT_CRYPTO_STATE.metric,
    range: VALID_CRYPTO_RANGES.has(range) ? range : DEFAULT_CRYPTO_STATE.range,
    asset: VALID_ASSETS.has(asset) ? asset : DEFAULT_CRYPTO_STATE.asset,
  };
}

export function readEquityStateFromHash() {
  const params = hashParams();
  const range = params.get("range");
  return {
    range: VALID_EQUITY_RANGES.has(range) ? range : DEFAULT_EQUITY_STATE.range,
  };
}

export function readMacroStateFromHash() {
  const params = hashParams();
  const category = params.get("category");
  return {
    category: VALID_MACRO_CATEGORIES.has(category) ? category : DEFAULT_MACRO_STATE.category,
  };
}

export function readChipChainStateFromHash() {
  const params = hashParams();
  const range = params.get("range");
  return {
    range: VALID_CHIP_CHAIN_RANGES.has(range) ? range : DEFAULT_CHIP_CHAIN_STATE.range,
  };
}

export function readRobotChainStateFromHash() {
  const params = hashParams();
  const range = params.get("range");
  return {
    range: VALID_ROBOT_CHAIN_RANGES.has(range) ? range : DEFAULT_ROBOT_CHAIN_STATE.range,
  };
}

export function replaceHashState(path, state) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  Object.entries(state).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  });
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const query = params.toString();
  const nextUrl = `${appUrl()}#/${cleanPath}${query ? `?${query}` : ""}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentUrl !== nextUrl) window.history.replaceState(null, "", nextUrl);
}

export function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

export const TRANSLATIONS = {
  zh: {
    htmlLang: "zh-CN",
    docTitle: "风险资产周期与轮动图",
    docDescription: "BTC、ETH、SOL、HYPE、BNB 月度收益周期与轮动可视化",
    separator: " · ",
    language: {
      aria: "切换页面语言",
      zh: "中",
      en: "EN",
    },
    options: {
      views: [
        { value: "rotation", label: "轮动总览" },
        { value: "cycle", label: "单币周期" },
      ],
      metrics: [
        { value: "absolute", label: "绝对收益" },
        { value: "relative", label: "相对 BTC" },
      ],
      ranges: [
        { value: "12", label: "12M" },
        { value: "24", label: "24M" },
        { value: "48", label: "48M" },
        { value: "all", label: "全部" },
      ],
    },
    controls: {
      chart: "图表控制",
      view: "视图",
      metric: "收益口径",
      range: "时间范围",
      asset: "选择币种",
    },
    months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    cycle: {
      "cycle-halving": "减半年",
      "cycle-big-bull": "大牛年",
      "cycle-correction": "回调年",
      "cycle-small-bull": "小牛年",
    },
    extreme: {
      unavailable: "极值顺序暂无数据",
      lowToHigh: "低点→高点",
      highToLow: "高点→低点",
      flat: "高低持平",
      gain: "潜在最大收益",
      loss: "潜在最大亏损",
      move: "月内极值变动",
    },
    status: {
      dataUnavailable: "数据未能加载",
      loading: "正在读取本地月度缓存…",
      dataFileFailed: "数据文件加载失败",
      dataLoadFailed: "数据加载失败",
    },
    header: {
      eyebrow: "RISK ASSET CYCLE MAP",
      titleAccent: "风险资产",
      titleRest: "周期与轮动图",
      subtitle: "按月观察 BTC、ETH、SOL、HYPE、BNB 的涨跌规律与轮动关系",
      cache: "本地缓存",
      cacheTooltip: "页面读取的是已保存的静态行情快照；现价和月线由后台定时更新，浏览器不会直接连接交易所或暴露密钥。",
      failure: (count) => `上游异常：${count}`,
      success: "五个来源更新成功",
    },
    latest: {
      aria: "各币种最新月度状态",
      inMonth: "月内",
      spot: "现价",
      spotUpdated: "现价刷新",
      spotUnavailable: "现价暂无",
    },
    insight: {
      label: "读图结论",
      cycleTitle: (asset) => `现在主看 ${asset}`,
      cycleBody: (asset, pct, extreme) => `${asset} 本月 ${pct}，月内极值变动 ${extreme}。点击历史月份可固定详情。`,
      rotationTitle: "轮动关系",
      rotationBody: (leader, ranking) => `最近月份领涨：${leader || "N/A"}。轮动顺序：${ranking || "暂无"}。`,
      selectedTitle: (symbol, monthKey) => `${symbol} ${monthKey}`,
      selectedBody: (pct, high, low, extreme) => `收益 ${pct}，高点 ${high}，低点 ${low}，极值变动 ${extreme}。`,
      shareHint: "当前筛选会写入网址，复制链接即可保留视图。",
      mobileHint: "手机端点击任意有数据的格子，会固定底部详情卡。",
    },
    visualization: {
      rotationAria: "轮动总览",
      cycleAria: (asset) => `${asset} 单币周期`,
      rotationKicker: "MONTHLY ROTATION",
      cycleKicker: "FOUR-YEAR CYCLE",
      rotationTitle: "月度轮动总览",
      cycleTitle: (asset) => `${asset} 四年周期矩阵`,
      absoluteMethod: "月收益 =（月收盘 − 月开盘）÷ 月开盘",
      relativeMethod: "相对收益 = 币种月收益 − BTC 月收益",
    },
    tables: {
      rotationCaption: "五币月度收益轮动总览",
      cycleCaption: (asset) => `${asset} 年份月份周期收益表`,
      month: "月份",
      leader: "当月领涨",
      cycleBackground: "BTC 周期背景",
      absoluteNote: "单元格显示月度绝对收益",
      relativeNote: "单元格显示相对 BTC 的月度超额收益（百分点）",
      year: "年份",
      total: "总计",
      cycle: "周期",
      median: "中位数",
      average: "平均数",
      noData: "无数据",
    },
    detail: {
      title: "查看细节",
      empty: "悬停查看月度信息，点击任一有数据的单元格即可固定详情。",
      closePinned: "关闭固定详情",
      selectedMonth: "已选月份",
      selectedYear: "已选年份",
      monthlyReturn: "月度收益",
      annualReturn: "当年收益",
      relativeBtc: "相对 BTC",
      open: "月开盘",
      close: "月收盘",
      currentPrice: "当前现价",
      high: "月内最高",
      low: "月内最低",
      status: "数据状态",
      closed: "已收盘",
      live: "本月进行中",
      source: "来源",
      ranking: "当月排名",
    },
    tooltip: {
      return: "收益",
      annualReturn: "当年收益",
      open: "开",
      close: "收",
      currentPrice: "现价",
      high: "高",
      low: "低",
      closed: "已收盘",
      live: "本月进行中",
    },
    legend: {
      aria: "收益率颜色图例",
      down: "跌",
      up: "涨",
      halving: "减半月",
    },
    footer: {
      title: "数据来源",
      trustTitle: "\u6570\u636e\u53ef\u4fe1\u5ea6\u4e0e\u65b9\u6cd5",
      status: "\u72b6\u6001",
      updated: "\u65f6\u95f4\u5ba1\u8ba1",
      timeAudit: "\u6570\u636e\u65f6\u95f4\u94fe\u8def",
      dataset: "\u6570\u636e\u96c6",
      observedAt: "\u4fe1\u6e90\u89c2\u6d4b",
      fetchedAt: "\u6293\u53d6\u5b8c\u6210",
      transformedAt: "\u8f6c\u6362\u5b8c\u6210",
      deployedAt: "\u90e8\u7f72\u5305\u751f\u6210",
      clientCheckedAt: "\u5ba2\u6237\u7aef\u68c0\u67e5",
      legacyTimestamp: "\u65e7\u7f13\u5b58\u7f3a\u5c11\u72ec\u7acb\u6293\u53d6\u65f6\u95f4\uff0c\u672c\u6b21\u4ec5\u4ee5\u65e7 generatedAt \u4f5c\u517c\u5bb9\u56de\u9000\uff1b\u4e0b\u6b21\u540e\u7aef\u5237\u65b0\u540e\u5c06\u4f7f\u7528\u72ec\u7acb\u5b57\u6bb5\u3002",
      sources: "\u6765\u6e90",
      methodology: "\u65b9\u6cd5",
      limitations: "\u9650\u5236\u8bf4\u660e",
      healthyStatus: "\u5df2\u52a0\u8f7d\u53ef\u7528\u7f13\u5b58",
      partialStatus: (count) => `\u6709 ${count} \u9879\u4e0a\u6e38\u63d0\u793a\uff0c\u5f53\u524d\u663e\u793a\u6700\u8fd1\u53ef\u7528\u7f13\u5b58`,
      unknown: "\u672a\u6807\u6ce8",
      staticCacheOnly: "\u524d\u7aef\u53ea\u8bfb\u53d6\u540e\u53f0\u6216 CI \u751f\u6210\u7684\u9759\u6001\u7f13\u5b58\uff1b\u884c\u60c5\u6e90\u5bc6\u94a5\u4e0d\u8fdb\u5165\u6d4f\u89c8\u5668\u3002",
    },
    nav: {
      crypto: "加密周期",
      equity: "美股大盘",
      macro: "\u5b8f\u89c2\u6d41\u52a8\u6027",
      marketClock: "开市轮动",
      chipChain: "芯片链热点",
      robotChain: "机器人链",
      admin: "后台",
    },
    equity: {
      docTitle: "美股大盘轮动图",
      docDescription: "QQQ、SPY 周度收益与 FRED 宏观指标轮动可视化",
      eyebrow: "EQUITY MACRO MAP · WEEKLY",
      titleAccent: "美股大盘",
      titleRest: "轮动图",
      subtitle: "从特朗普第二任期开始，按周观察 QQQ、SPY、利率与波动率的联动",
      cache: "周度缓存",
      cacheTooltip: "页面读取的是已保存的静态周度快照；价格和宏观数据由后台定时更新，浏览器不会接触 FRED 密钥。",
      success: "价格与 FRED 更新成功",
      failure: (count) => `数据源异常：${count}`,
      loading: "正在读取本地周度缓存…",
      unavailable: "美股数据未能加载",
      latestWeek: "最新周",
      qqq: "QQQ",
      spy: "SPY",
      relative: "QQQ - SPY",
      tenYear: "10Y 变化",
      vix: "VIX 变化",
      controls: "美股图表控制",
      range: "时间范围",
      ranges: [
        { value: "26", label: "26W" },
        { value: "52", label: "52W" },
        { value: "all", label: "全部" },
      ],
      tableCaption: "QQQ 与 SPY 周度宏观轮动表",
      visualTitle: "周度宏观轮动表",
      week: "周",
      qqqReturn: "QQQ 周收益",
      spyReturn: "SPY 周收益",
      relativeReturn: "相对强弱",
      leader: "领涨",
      macro: "宏观",
      events: "事件",
      noEvents: "事件层预留",
      emptyDetailTitle: "查看周度详情",
      emptyDetailBody: "悬停查看周度信息，点击任一有数据的单元格即可固定详情。",
      selectedWeek: "已选周",
      tradingDays: "交易区间",
      weeklyOpenClose: "开盘 / 收盘",
      highLow: "最高 / 最低",
      dataSource: "数据来源",
      priceSourceNote: "价格来自 AKShare/Sina 美股日线；宏观来自 FRED。前端只读取静态缓存。",
      method: "周收益 =（周收盘 − 周开盘）÷ 周开盘；相对强弱 = QQQ 周收益 − SPY 周收益",
      eventPlaceholder: "事件标注接口已预留，本版暂不自动抓取或人工编辑事件。",
    },
    macroCalendar: {
      docTitle: "\u5b8f\u89c2\u6d41\u52a8\u6027\u65e5\u5386",
      docDescription: "\u98ce\u9669\u8d44\u4ea7\u7684\u5b8f\u89c2\u3001\u5229\u7387\u3001\u7f8e\u5143\u3001\u6ce2\u52a8\u7387\u4e0e\u4fe1\u7528\u5229\u5dee\u89c2\u6d4b\u65e5\u5386",
      eyebrow: "EVENT & LIQUIDITY MAP",
      titleAccent: "\u5b8f\u89c2\u6d41\u52a8\u6027",
      titleRest: "\u65e5\u5386",
      subtitle: "\u7528\u534a\u5e74\u671f FRED \u89c2\u6d4b\u6570\u636e\u8865\u8db3\u4ef7\u683c\u80cc\u540e\u7684\u901a\u80c0\u3001\u589e\u957f\u3001\u5229\u7387\u4e0e\u98ce\u9669\u504f\u597d\u7ebf\u7d22",
      cache: "\u5b8f\u89c2\u7f13\u5b58",
      cacheTooltip: "\u9875\u9762\u53ea\u8bfb\u53d6\u540e\u53f0\u751f\u6210\u7684\u9759\u6001\u5b8f\u89c2\u6570\u636e\u3002FRED API \u5bc6\u94a5\u53ea\u5728\u672c\u5730\u6216 CI \u811a\u672c\u4e2d\u4f7f\u7528\uff0c\u4e0d\u4f1a\u8fdb\u5165\u524d\u7aef\u3002",
      success: "\u5b8f\u89c2\u6570\u636e\u5df2\u66f4\u65b0",
      failure: (count) => `\u4e0a\u6e38\u5f02\u5e38\uff1a${count}`,
      loading: "\u6b63\u5728\u8bfb\u53d6\u672c\u5730\u5b8f\u89c2\u7f13\u5b58\u2026",
      unavailable: "\u5b8f\u89c2\u65e5\u5386\u6570\u636e\u672a\u80fd\u52a0\u8f7d",
      controls: "\u5b8f\u89c2\u65e5\u5386\u63a7\u5236",
      category: "\u7c7b\u522b",
      all: "\u5168\u90e8",
      categories: {
        inflation: "\u901a\u80c0",
        growth: "\u5c31\u4e1a\u4e0e\u589e\u957f",
        rates: "\u5229\u7387\u4e0e\u7f8e\u5143",
        volatility: "\u6ce2\u52a8\u4e0e\u4fe1\u7528",
        other: "\u5176\u4ed6",
      },
      eventLabels: {
        "ADP private payrolls": "ADP\u5c0f\u975e\u519c",
        "Average hourly earnings": "\u5e73\u5747\u65f6\u85aa",
        "Broad USD index": "\u5e7f\u4e49\u7f8e\u5143\u6307\u6570",
        "China Dragon Boat Festival holiday": "\u4e2d\u56fd\u7aef\u5348\u8282\u5047\u671f",
        "China Labor Day holiday": "\u4e2d\u56fd\u52b3\u52a8\u8282\u5047\u671f",
        "China Mid-Autumn Festival holiday": "\u4e2d\u56fd\u4e2d\u79cb\u8282\u5047\u671f",
        "China National Day holiday": "\u4e2d\u56fd\u56fd\u5e86\u8282\u5047\u671f",
        "China Qingming Festival holiday": "\u4e2d\u56fd\u6e05\u660e\u8282\u5047\u671f",
        "China Spring Festival holiday": "\u4e2d\u56fd\u6625\u8282\u5047\u671f",
        "China 3M interbank rate": "\u4e2d\u56fd3M\u540c\u4e1a\u5229\u7387",
        "Consumer sentiment": "\u5bc6\u5927\u6d88\u8d39\u8005\u4fe1\u5fc3",
        "Core CPI": "\u6838\u5fc3CPI",
        "Core PCE": "\u6838\u5fc3PCE",
        "Core PPI goods": "\u6838\u5fc3PPI\u5546\u54c1",
        "CPI": "CPI",
        "CPI monthly inflation rate": "CPI\u6708\u901a\u80c0\u7387",
        "CPI yearly inflation rate": "CPI\u5e74\u901a\u80c0\u7387",
        "Effective fed funds": "\u6709\u6548\u8054\u90a6\u57fa\u91d1\u5229\u7387",
        "Fed target range": "\u8054\u50a8\u76ee\u6807\u5229\u7387\u533a\u95f4",
        "FOMC fed funds median projection": "FOMC\u70b9\u9635\u56fe\u4e2d\u503c",
        "FOMC longer-run fed funds median": "FOMC\u957f\u671f\u5229\u7387\u4e2d\u503c",
        "FOMC meeting minutes": "FOMC\u4f1a\u8bae\u7eaa\u8981",
        "FOMC rate decision": "FOMC\u5229\u7387\u51b3\u8bae",
        "Industrial production": "\u5de5\u4e1a\u4ea7\u51fa",
        "Initial jobless claims": "\u521d\u8bf7\u5931\u4e1a\u91d1",
        "Japan overnight rate": "\u65e5\u672c\u9694\u591c\u5229\u7387",
        "M2 money stock": "M2\u8d27\u5e01\u4f9b\u5e94",
        "Nonfarm payrolls": "\u975e\u519c\u5c31\u4e1a",
        "PCE price index": "PCE\u7269\u4ef7\u6307\u6570",
        "PPI": "PPI",
        "Real GDP": "\u5b9e\u9645GDP",
        "Retail sales": "\u96f6\u552e\u9500\u552e",
        "U.S. Christmas Day holiday": "\u7f8e\u56fd\u5723\u8bde\u8282\u5047\u671f",
        "U.S. Columbus Day holiday": "\u7f8e\u56fd\u54e5\u4f26\u5e03\u65e5\u5047\u671f",
        "U.S. Independence Day holiday": "\u7f8e\u56fd\u72ec\u7acb\u65e5\u5047\u671f",
        "U.S. Juneteenth holiday": "\u7f8e\u56fd\u516d\u6708\u8282\u5047\u671f",
        "U.S. Labor Day holiday": "\u7f8e\u56fd\u52b3\u5de5\u8282\u5047\u671f",
        "U.S. Martin Luther King Jr. Day holiday": "\u7f8e\u56fd\u9a6c\u4e01\u8def\u5fb7\u91d1\u65e5\u5047\u671f",
        "U.S. Memorial Day holiday": "\u7f8e\u56fd\u9635\u4ea1\u5c06\u58eb\u7eaa\u5ff5\u65e5\u5047\u671f",
        "U.S. New Year's Day holiday": "\u7f8e\u56fd\u65b0\u5e74\u5047\u671f",
        "U.S. Thanksgiving Day holiday": "\u7f8e\u56fd\u611f\u6069\u8282\u5047\u671f",
        "U.S. Veterans Day holiday": "\u7f8e\u56fd\u9000\u4f0d\u519b\u4eba\u8282\u5047\u671f",
        "U.S. Washington's Birthday holiday": "\u7f8e\u56fd\u534e\u76db\u987f\u8bde\u8fb0\u5047\u671f",
        "Unemployment rate": "\u5931\u4e1a\u7387",
      },
      eventLabelPrefixes: {
        ADP_PRIVATE_PAYROLLS: "ADP\u5c0f\u975e\u519c",
        CN_PUBLIC_HOLIDAY: "\u4e2d\u56fd\u6cd5\u5b9a\u8282\u5047\u65e5",
        FOMC_MINUTES_SCHEDULED: "FOMC\u4f1a\u8bae\u7eaa\u8981",
        FOMC_RATE_DECISION_SCHEDULED: "FOMC\u5229\u7387\u51b3\u8bae",
        US_FEDERAL_HOLIDAY: "\u7f8e\u56fd\u6cd5\u5b9a\u8282\u5047\u65e5",
      },
      compactEventLabels: {
        "ADP\u5c0f\u975e\u519c": "ADP\u5c0f\u975e\u519c",
        "CPI\u5e74\u901a\u80c0\u7387": "CPI\u5e74",
        "CPI\u6708\u901a\u80c0\u7387": "CPI\u6708",
        "FOMC\u4f1a\u8bae\u7eaa\u8981": "FOMC\u7eaa\u8981",
        "FOMC\u5229\u7387\u51b3\u8bae": "FOMC\u51b3\u8bae",
        "\u4e2d\u56fd\u6cd5\u5b9a\u8282\u5047\u65e5": "\u4e2d\u56fd\u5047\u65e5",
        "\u4e2d\u56fd\u6625\u8282\u5047\u671f": "\u6625\u8282",
        "\u4e2d\u56fd\u6e05\u660e\u8282\u5047\u671f": "\u6e05\u660e",
        "\u4e2d\u56fd\u52b3\u52a8\u8282\u5047\u671f": "\u52b3\u52a8\u8282",
        "\u4e2d\u56fd\u7aef\u5348\u8282\u5047\u671f": "\u7aef\u5348",
        "\u4e2d\u56fd\u4e2d\u79cb\u8282\u5047\u671f": "\u4e2d\u79cb",
        "\u4e2d\u56fd\u56fd\u5e86\u8282\u5047\u671f": "\u56fd\u5e86",
        "\u7f8e\u56fd\u72ec\u7acb\u65e5\u5047\u671f": "\u72ec\u7acb\u65e5",
        "\u7f8e\u56fd\u6cd5\u5b9a\u8282\u5047\u65e5": "\u7f8e\u56fd\u5047\u65e5",
        "\u975e\u519c\u5c31\u4e1a": "\u975e\u519c",
        "\u5931\u4e1a\u7387": "\u5931\u4e1a\u7387",
      },
      compactCategories: {
        inflation: "\u901a\u80c0",
        growth: "\u589e\u957f",
        rates: "\u5229\u7387",
        volatility: "\u6ce2\u52a8",
        liquidity: "\u6d41\u52a8",
        other: "\u5176\u4ed6",
      },
      hiddenMonthItems: (count) => `+${count}`,
      window: "\u6570\u636e\u7a97\u53e3",
      eventCount: "\u89c2\u6d4b\u4e8b\u4ef6",
      latestEvent: "\u6700\u65b0\u89c2\u6d4b",
      noLatest: "N/A",
      eventsTitle: "\u6307\u6807\u89c2\u6d4b",
      eventsCaption: "\u534a\u5e74\u671f\u5b8f\u89c2\u6307\u6807\u89c2\u6d4b\u8868",
      stateTitle: "\u5468\u5ea6\u72b6\u6001\u80cc\u666f",
      stateCaption: "\u5229\u7387\u3001\u7f8e\u5143\u3001\u6ce2\u52a8\u7387\u548c\u4fe1\u7528\u5229\u5dee\u7684\u5468\u5ea6\u72b6\u6001\u8868",
      methodology: "\u5386\u53f2\u89c2\u6d4b\u65e5\u4e0d\u7b49\u4e8e\u771f\u5b9e\u53d1\u5e03\u65f6\u95f4\uff1b\u672a\u6765 BLS \u6392\u671f\u6765\u81ea FRED release-date API\uff0cADP \u5c0f\u975e\u519c\u6765\u81ea ADP \u5b98\u65b9\u9759\u6001\u6570\u636e\uff0cFOMC \u6765\u81ea\u7f8e\u8054\u50a8\u65e5\u5386\uff1b\u8282\u5047\u65e5\u4f7f\u7528\u7f8e\u56fd\u8054\u90a6\u89c2\u5bdf\u65e5\u89c4\u5219\u548c\u4e2d\u56fd\u8282\u65e5\u4eba\u5de5\u6ce8\u91ca\u3002",
      date: "\u65e5\u671f",
      indicator: "\u6307\u6807",
      actual: "\u5b9e\u9645",
      previous: "\u524d\u503c",
      forecast: "\u9884\u6d4b",
      change: "\u53d8\u5316",
      yoy: "\u540c\u6bd4",
      source: "\u6765\u6e90",
      dateMeaning: "\u65e5\u671f\u542b\u4e49",
      dailyObservation: "\u65e5\u9891\u89c2\u5bdf",
      selected: "\u5df2\u9009\u89c2\u6d4b",
      emptyDetailTitle: "\u67e5\u770b\u5b8f\u89c2\u7ec6\u8282",
      emptyDetailBody: "\u70b9\u51fb\u4efb\u610f\u89c2\u6d4b\u884c\uff0c\u53ef\u5728\u4e0b\u65b9\u56fa\u5b9a\u5b83\u7684\u524d\u503c\u3001\u5b9e\u9645\u503c\u3001\u53d8\u5316\u548c\u6570\u636e\u542b\u4e49\u3002",
      observationPeriod: "\u89c2\u6d4b\u671f",
      projectionYear: "\u9884\u6d4b\u5e74",
      sepProjection: "SEP \u89c2\u6d4b",
      scheduledBeijingDate: "\u5317\u4eac\u65f6\u95f4\u6392\u671f",
      observedHolidayDate: "\u8282\u5047\u65e5\u89c2\u5bdf\u65e5",
      holiday: "\u8282\u65e5",
      observedDate: "\u89c2\u5bdf\u65e5",
      legalDate: "\u6cd5\u5b9a\u65e5",
      country: "\u56fd\u5bb6",
      countries: {
        CN: "\u4e2d\u56fd",
        US: "\u7f8e\u56fd",
      },
      holidayObservedNote: (observedDate, legalDate) => `\u89c2\u5bdf\u65e5 ${observedDate}\uff1b\u6cd5\u5b9a\u65e5 ${legalDate}\u3002`,
      holidaySameDayNote: (observedDate) => `\u8282\u5047\u65e5 ${observedDate}\u3002`,
      week: "\u5468",
      twoYear: "2Y",
      tenYear: "10Y",
      realYield: "\u5b9e\u9645\u5229\u7387",
      dollar: "\u7f8e\u5143",
      vix: "VIX",
      credit: "\u4fe1\u7528",
      stress: "\u538b\u529b",
      noRows: "\u6682\u65e0\u5339\u914d\u6570\u636e",
      sourceNote: "\u5f53\u524d\u4f7f\u7528 FRED \u5b98\u65b9 API\u3001FRED release-date API\u3001ADP \u5b98\u65b9\u9759\u6001\u6570\u636e\u3001\u7f8e\u8054\u50a8 FOMC \u65e5\u5386\u3001\u7f8e\u56fd\u8054\u90a6\u8282\u5047\u65e5\u89c4\u5219\u548c\u4e2d\u56fd\u8282\u65e5\u4eba\u5de5\u6ce8\u91ca\uff1b\u672a\u4f7f\u7528 yfinance\uff0c\u4e5f\u672a\u63a5\u5165\u672a\u5ba1\u67e5\u7684\u9884\u6d4b\u6765\u6e90\u3002",
      environmentTitle: "\u5f53\u524d\u5b8f\u89c2\u73af\u5883",
      weekCalendarTitle: "\u672c\u5468\u73af\u5883\u5468\u5386",
      monthCalendarTitle: "\u6708\u5ea6\u6307\u6807\u65e5\u5386",
      monthDetailTitle: "\u65e5\u671f\u8be6\u60c5",
      currentWeek: "\u672c\u5468",
      riskPosture: "\u98ce\u9669\u504f\u597d",
      pressureHigh: "\u504f\u627f\u538b",
      pressureMedium: "\u4e2d\u6027\u504f\u7d27",
      pressureLow: "\u76f8\u5bf9\u53cb\u597d",
      liquidity: "\u6d41\u52a8\u6027",
      quarterWindow: "\u5b63\u672b\u7a97\u53e3",
      monthWindow: "\u6708\u672b\u7a97\u53e3",
      sellPressureExhausted: "\u5356\u538b\u6e10\u7aed",
      earningsSeason: "\u8d22\u62a5\u5b63",
      earningsSeasonWindow: "\u8d22\u62a5\u5b63\u7a97\u53e3",
      earningsSeasonNotice: "7 \u6708\u4e2d\u65ec\u5230\u6708\u5e95\u7684\u7f8e\u80a1\u8d22\u62a5\u5b63\u7a97\u53e3\uff0c\u7528\u4e8e\u63d0\u793a\u98ce\u9669\u504f\u597d\u548c\u6ce2\u52a8\u7387\u53ef\u80fd\u88ab\u4e2a\u80a1\u8d22\u62a5\u548c\u6307\u5f15\u5f71\u54cd\u3002",
      noData: "\u65e0\u6570\u636e",
      noIndicators: "\u5f53\u65e5\u65e0\u6307\u6807",
      clickDateHint: "\u70b9\u51fb\u65e5\u671f\u67e5\u770b\u8be6\u60c5",
      selectedDate: "\u5df2\u9009\u65e5\u671f",
      asOf: (date) => `\u622a\u81f3 ${date}`,
      periodNotice: "\u5386\u53f2\u884c\u4f7f\u7528 FRED \u89c2\u6d4b\u671f\u65e5\u671f\uff1b\u672a\u6765\u6392\u671f\u884c\u6309\u5f53\u524d\u8bed\u8a00\u5207\u6362\u65e5\u671f\uff1a\u4e2d\u6587\u4e3a\u5317\u4eac\u65f6\u95f4\uff0c\u82f1\u6587\u4e3a\u7ebd\u7ea6\u65f6\u95f4\u3002",
      previousMonth: "\u4e0a\u6708",
      nextMonth: "\u4e0b\u6708",
      previousWeek: "\u4e0a\u5468",
      nextWeek: "\u4e0b\u5468",
      weekdays: ["\u65e5", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d"],
      weekdayNames: ["\u5468\u65e5", "\u5468\u4e00", "\u5468\u4e8c", "\u5468\u4e09", "\u5468\u56db", "\u5468\u4e94", "\u5468\u516d"],
    },
  },
  en: {
    htmlLang: "en",
    docTitle: "Risk Asset Cycle & Rotation Map",
    docDescription: "Monthly return cycle and rotation visualization for BTC, ETH, SOL, HYPE, and BNB",
    separator: " · ",
    language: {
      aria: "Switch page language",
      zh: "中",
      en: "EN",
    },
    options: {
      views: [
        { value: "rotation", label: "Rotation" },
        { value: "cycle", label: "Single Asset" },
      ],
      metrics: [
        { value: "absolute", label: "Absolute Return" },
        { value: "relative", label: "Relative to BTC" },
      ],
      ranges: [
        { value: "12", label: "12M" },
        { value: "24", label: "24M" },
        { value: "48", label: "48M" },
        { value: "all", label: "All" },
      ],
    },
    controls: {
      chart: "Chart controls",
      view: "View",
      metric: "Return metric",
      range: "Time range",
      asset: "Select asset",
    },
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    cycle: {
      "cycle-halving": "Halving",
      "cycle-big-bull": "Major bull",
      "cycle-correction": "Correction",
      "cycle-small-bull": "Minor bull",
    },
    extreme: {
      unavailable: "Extreme order unavailable",
      lowToHigh: "Low→High",
      highToLow: "High→Low",
      flat: "Flat extremes",
      gain: "Max potential gain",
      loss: "Max potential loss",
      move: "Intramonth extreme move",
    },
    status: {
      dataUnavailable: "Data could not be loaded",
      loading: "Reading local monthly cache…",
      dataFileFailed: "Data file failed to load",
      dataLoadFailed: "Data loading failed",
    },
    header: {
      eyebrow: "RISK ASSET CYCLE MAP",
      titleAccent: "Risk Assets",
      titleRest: "Cycle & Rotation Map",
      subtitle: "Track monthly return patterns and rotation across BTC, ETH, SOL, HYPE, and BNB",
      cache: "Local cache",
      cacheTooltip: "The page reads a saved static market snapshot. Scheduled backend jobs refresh prices and monthly data; the browser never connects to exchanges with credentials.",
      failure: (count) => `Upstream issues: ${count}`,
      success: "All five sources updated",
    },
    latest: {
      aria: "Latest monthly status by asset",
      inMonth: "live month",
      spot: "Spot",
      spotUpdated: "Spot updated",
      spotUnavailable: "Spot unavailable",
    },
    insight: {
      label: "Reading guide",
      cycleTitle: (asset) => `Currently focused on ${asset}`,
      cycleBody: (asset, pct, extreme) => `${asset} is ${pct} this month, with an intramonth extreme move of ${extreme}. Click any historical month to pin details.`,
      rotationTitle: "Rotation view",
      rotationBody: (leader, ranking) => `Latest monthly leader: ${leader || "N/A"}. Rotation order: ${ranking || "none yet"}.`,
      selectedTitle: (symbol, monthKey) => `${symbol} ${monthKey}`,
      selectedBody: (pct, high, low, extreme) => `Return ${pct}, high ${high}, low ${low}, extreme move ${extreme}.`,
      shareHint: "The current filters are written into the URL, so copied links keep this view.",
      mobileHint: "On mobile, tap any populated cell to pin the bottom detail card.",
    },
    visualization: {
      rotationAria: "Rotation overview",
      cycleAria: (asset) => `${asset} single-asset cycle`,
      rotationKicker: "MONTHLY ROTATION",
      cycleKicker: "FOUR-YEAR CYCLE",
      rotationTitle: "Monthly rotation overview",
      cycleTitle: (asset) => `${asset} four-year cycle matrix`,
      absoluteMethod: "Monthly return = (monthly close − monthly open) ÷ monthly open",
      relativeMethod: "Relative return = asset monthly return − BTC monthly return",
    },
    tables: {
      rotationCaption: "Monthly return rotation overview for five assets",
      cycleCaption: (asset) => `${asset} yearly monthly cycle return table`,
      month: "Month",
      leader: "Leader",
      cycleBackground: "BTC cycle",
      absoluteNote: "Cells show absolute monthly returns",
      relativeNote: "Cells show monthly excess return versus BTC in percentage points",
      year: "Year",
      total: "Total",
      cycle: "Cycle",
      median: "Median",
      average: "Average",
      noData: "No data",
    },
    detail: {
      title: "Details",
      empty: "Hover for monthly information, or click any populated cell to pin the detail view.",
      closePinned: "Close pinned detail",
      selectedMonth: "Selected month",
      selectedYear: "Selected year",
      monthlyReturn: "Monthly return",
      annualReturn: "Annual return",
      relativeBtc: "Relative to BTC",
      open: "Monthly open",
      close: "Monthly close",
      currentPrice: "Current spot",
      high: "Monthly high",
      low: "Monthly low",
      status: "Data status",
      closed: "Closed",
      live: "Current month",
      source: "Source",
      ranking: "Monthly rank",
    },
    tooltip: {
      return: "Return",
      annualReturn: "Annual return",
      open: "Open",
      close: "Close",
      currentPrice: "Spot",
      high: "High",
      low: "Low",
      closed: "Closed",
      live: "Current month",
    },
    legend: {
      aria: "Return color legend",
      down: "Down",
      up: "Up",
      halving: "Halving month",
    },
    footer: {
      title: "Data sources",
      trustTitle: "Data trust & methodology",
      status: "Status",
      updated: "Time audit",
      timeAudit: "Data timestamp chain",
      dataset: "Dataset",
      observedAt: "Source observed",
      fetchedAt: "Fetch completed",
      transformedAt: "Transform completed",
      deployedAt: "Deploy artifact",
      clientCheckedAt: "Client checked",
      legacyTimestamp: "This legacy cache did not record fetch time separately, so generatedAt is shown only as a compatibility fallback until the next backend refresh.",
      sources: "Sources",
      methodology: "Methodology",
      limitations: "Limitations",
      healthyStatus: "Available cache loaded",
      partialStatus: (count) => `${count} upstream note${count === 1 ? "" : "s"}; showing the last available cache`,
      unknown: "Not stated",
      staticCacheOnly: "The frontend reads only backend or CI generated static caches; market-data credentials never enter the browser.",
    },
    nav: {
      crypto: "Crypto cycle",
      equity: "US market",
      macro: "Macro & liquidity",
      marketClock: "Market clock",
      chipChain: "Chip chain",
      robotChain: "Robot chain",
      admin: "Admin",
    },
    equity: {
      docTitle: "US Market Rotation Map",
      docDescription: "Weekly QQQ, SPY, and FRED macro rotation visualization",
      eyebrow: "EQUITY MACRO MAP · WEEKLY",
      titleAccent: "US Market",
      titleRest: "Rotation Map",
      subtitle: "Track QQQ, SPY, rates, and volatility by week from Trump's second term",
      cache: "Weekly cache",
      cacheTooltip: "The page reads a saved static weekly snapshot. Scheduled backend jobs refresh price and macro data; the browser never receives the FRED key.",
      success: "Prices and FRED updated",
      failure: (count) => `Source issues: ${count}`,
      loading: "Reading local weekly cache…",
      unavailable: "Equity data could not be loaded",
      latestWeek: "Latest week",
      qqq: "QQQ",
      spy: "SPY",
      relative: "QQQ - SPY",
      tenYear: "10Y change",
      vix: "VIX change",
      controls: "Equity chart controls",
      range: "Time range",
      ranges: [
        { value: "26", label: "26W" },
        { value: "52", label: "52W" },
        { value: "all", label: "All" },
      ],
      tableCaption: "Weekly macro rotation table for QQQ and SPY",
      visualTitle: "Weekly macro rotation",
      week: "Week",
      qqqReturn: "QQQ weekly return",
      spyReturn: "SPY weekly return",
      relativeReturn: "Relative strength",
      leader: "Leader",
      macro: "Macro",
      events: "Events",
      noEvents: "Event layer reserved",
      emptyDetailTitle: "Weekly details",
      emptyDetailBody: "Hover for weekly information, or click any populated cell to pin the detail view.",
      selectedWeek: "Selected week",
      tradingDays: "Trading window",
      weeklyOpenClose: "Open / close",
      highLow: "High / low",
      dataSource: "Data source",
      priceSourceNote: "Prices use AKShare/Sina U.S. daily data; macro data uses FRED. The frontend reads static cache only.",
      method: "Weekly return = (weekly close − weekly open) ÷ weekly open; relative strength = QQQ weekly return − SPY weekly return",
      eventPlaceholder: "Event annotation fields are reserved; this MVP does not auto-fetch or edit events.",
    },
    macroCalendar: {
      docTitle: "Macro & Liquidity Calendar",
      docDescription: "Macro, rates, dollar, volatility, and credit observations for risk assets",
      eyebrow: "EVENT & LIQUIDITY MAP",
      titleAccent: "Macro & Liquidity",
      titleRest: "Calendar",
      subtitle: "A six-month FRED-backed context layer for inflation, growth, rates, dollar strength, volatility, and credit stress.",
      cache: "Macro cache",
      cacheTooltip: "The page reads a generated static macro snapshot. The FRED API key is used only by local or CI scripts and is never sent to the browser.",
      success: "Macro data updated",
      failure: (count) => `Source issues: ${count}`,
      loading: "Reading local macro cache...",
      unavailable: "Macro calendar data could not be loaded",
      controls: "Macro calendar controls",
      category: "Category",
      all: "All",
      categories: {
        inflation: "Inflation",
        growth: "Employment & growth",
        rates: "Rates & dollar",
        volatility: "Volatility & credit",
        other: "Other",
      },
      eventLabelPrefixes: {
        CN_PUBLIC_HOLIDAY: "China public holiday",
        US_FEDERAL_HOLIDAY: "U.S. federal holiday",
      },
      compactEventLabels: {
        "China Dragon Boat Festival holiday": "Dragon Boat",
        "China Labor Day holiday": "Labor Day",
        "China Mid-Autumn Festival holiday": "Mid-Autumn",
        "China National Day holiday": "National Day",
        "China public holiday": "China holiday",
        "China Qingming Festival holiday": "Qingming",
        "China Spring Festival holiday": "Spring Festival",
        "U.S. Independence Day holiday": "Independence Day",
        "U.S. federal holiday": "U.S. holiday",
      },
      compactCategories: {
        inflation: "Infl",
        growth: "Growth",
        rates: "Rates",
        volatility: "Vol",
        liquidity: "Liq",
        other: "Other",
      },
      hiddenMonthItems: (count) => `+${count}`,
      window: "Data window",
      eventCount: "Observations",
      latestEvent: "Latest observation",
      noLatest: "N/A",
      eventsTitle: "Indicator observations",
      eventsCaption: "Six-month macro indicator observation table",
      stateTitle: "Weekly state backdrop",
      stateCaption: "Weekly rates, dollar, volatility, and credit spread state table",
      methodology: "Historical observation dates are not release timestamps. Future BLS schedules come from the FRED release-date API; ADP small-nonfarm rows come from ADP's official static data; FOMC rows come from the Federal Reserve calendar; holiday rows use U.S. federal observed-date rules and manual China festival-date annotations.",
      date: "Date",
      indicator: "Indicator",
      actual: "Actual",
      previous: "Previous",
      forecast: "Forecast",
      change: "Change",
      yoy: "YoY",
      source: "Source",
      dateMeaning: "Date meaning",
      dailyObservation: "Daily observation",
      selected: "Selected observation",
      emptyDetailTitle: "Macro details",
      emptyDetailBody: "Click any observation row to pin its previous value, actual value, change, and data semantics below.",
      observationPeriod: "Observation period",
      projectionYear: "Projection year",
      sepProjection: "SEP observation",
      scheduledBeijingDate: "Beijing scheduled date",
      observedHolidayDate: "Observed holiday date",
      holiday: "Holiday",
      observedDate: "Observed date",
      legalDate: "Legal date",
      country: "Country",
      countries: {
        CN: "China",
        US: "United States",
      },
      holidayObservedNote: (observedDate, legalDate) => `Observed ${observedDate}; legal date ${legalDate}.`,
      holidaySameDayNote: (observedDate) => `Holiday date ${observedDate}.`,
      week: "Week",
      twoYear: "2Y",
      tenYear: "10Y",
      realYield: "Real yield",
      dollar: "Dollar",
      vix: "VIX",
      credit: "Credit",
      stress: "Stress",
      noRows: "No matching rows",
      sourceNote: "This version uses the official FRED API, the FRED release-date API, ADP's official static data, local cache, the Federal Reserve FOMC calendar, U.S. federal holiday rules, and manual China holiday annotations. It does not use yfinance or unreviewed forecast sources.",
      environmentTitle: "Current macro environment",
      weekCalendarTitle: "This week calendar",
      monthCalendarTitle: "Monthly indicator calendar",
      monthDetailTitle: "Date details",
      currentWeek: "This week",
      riskPosture: "Risk posture",
      pressureHigh: "Pressured",
      pressureMedium: "Neutral-tight",
      pressureLow: "Supportive",
      liquidity: "Liquidity",
      quarterWindow: "Quarter-end window",
      monthWindow: "Month-end window",
      sellPressureExhausted: "Selling pressure exhausted",
      earningsSeason: "Earnings season",
      earningsSeasonWindow: "Earnings season window",
      earningsSeasonNotice: "U.S. earnings-season window from mid-July to month-end, used as a risk-appetite and volatility attention marker.",
      noData: "No data",
      noIndicators: "No indicators",
      clickDateHint: "Click a date for details",
      selectedDate: "Selected date",
      asOf: (date) => `as of ${date}`,
      periodNotice: "Historical rows use FRED observation-period dates; future scheduled rows follow the current language: Chinese uses Beijing dates, English uses New York dates.",
      previousMonth: "Previous",
      nextMonth: "Next",
      previousWeek: "Previous week",
      nextWeek: "Next week",
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      weekdayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    },
  },
};

export function getInitialLanguage() {
  if (typeof window === "undefined") return "zh";
  try {
    const stored = window.localStorage.getItem("cycle-map-language");
    return stored === "en" || stored === "zh" ? stored : "zh";
  } catch {
    return "zh";
  }
}

export function cycleLabel(cycle, t) {
  return t.cycle[cycle?.className] || cycle?.label || "";
}

export function extremeMoveMeta(row, t) {
  const value = row?.extremeMovePct;
  if (!Number.isFinite(value)) return { label: t.extreme.unavailable, order: "", className: "" };
  const order = row?.firstExtreme === "low"
    ? t.extreme.lowToHigh
    : row?.firstExtreme === "high"
      ? t.extreme.highToLow
      : t.extreme.flat;
  if (value > 0) return { label: t.extreme.gain, order, className: "positive" };
  if (value < 0) return { label: t.extreme.loss, order, className: "negative" };
  return { label: t.extreme.move, order, className: "" };
}

export function Segmented({ label, options, value, onChange, compact = false }) {
  return (
    <div className={`segmented ${compact ? "segmented-compact" : ""}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={value === option.value ? "is-active" : ""}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function LanguageToggle({ language, onChange, t }) {
  return (
    <div className="language-toggle" role="group" aria-label={t.language.aria}>
      <button
        type="button"
        className={language === "zh" ? "is-active" : ""}
        aria-pressed={language === "zh"}
        onClick={() => onChange("zh")}
      >
        {t.language.zh}
      </button>
      <button
        type="button"
        className={language === "en" ? "is-active" : ""}
        aria-pressed={language === "en"}
        onClick={() => onChange("en")}
      >
        {t.language.en}
      </button>
    </div>
  );
}

export function CacheStatus({ label, tooltip }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;
  return (
    <div
      className="cache-status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="cache-badge"
        aria-expanded={open}
        aria-describedby="cache-status-tooltip"
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {label}
      </button>
      <span
        id="cache-status-tooltip"
        role="tooltip"
        className={`cache-tooltip ${open ? "is-open" : ""}`}
      >
        {tooltip}
      </span>
    </div>
  );
}

export function textBlock(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  return value || "";
}

export function buildFreshnessItem(label, metadata, dataset) {
  const timestamps = dataset?.timestamps || {};
  return {
    label,
    observedAt: metadata?.observedAt || timestamps.observedAt || null,
    fetchedAt: metadata?.fetchedAt || timestamps.fetchedAt || null,
    transformedAt: metadata?.transformedAt || timestamps.transformedAt || dataset?.generatedAt || null,
    deployedAt: metadata?.deployedAt || null,
    clientCheckedAt: metadata?.clientCheckedAt || null,
    timestampFallback: metadata?.timestampFallback || null,
  };
}

export function TimestampValue({ value, language, unknown }) {
  if (!value) return <span>{unknown}</span>;
  return (
    <span data-timestamp={value} title={freshnessLabel(value, language)}>
      <b>{delayLabel(value, language)}</b>
      <small>{freshnessLabel(value, language)}</small>
    </span>
  );
}

export function DataFreshnessSummary({ items, language, t }) {
  return (
    <div className="freshness-summary" data-testid="freshness-summary">
      {items.map((item) => (
        <strong key={item.label} title={`${t.footer.observedAt}: ${freshnessLabel(item.observedAt, language)}; ${t.footer.clientCheckedAt}: ${freshnessLabel(item.clientCheckedAt, language)}`}>
          <span>{item.label}</span>
          {t.footer.observedAt} {delayLabel(item.observedAt, language)} · {t.footer.clientCheckedAt} {delayLabel(item.clientCheckedAt, language)}
        </strong>
      ))}
    </div>
  );
}

export function FreshnessAuditTable({ items, language, t }) {
  const fields = ["observedAt", "fetchedAt", "transformedAt", "deployedAt", "clientCheckedAt"];
  return (
    <div className="freshness-audit-shell">
      <table className="freshness-audit-table" data-testid="freshness-audit">
        <caption>{t.footer.timeAudit}</caption>
        <thead>
          <tr>
            <th scope="col">{t.footer.dataset}</th>
            {fields.map((field) => <th scope="col" key={field}>{t.footer[field]}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.label}>
              <th scope="row">{item.label}</th>
              {fields.map((field) => <td key={field}><TimestampValue value={item[field]} language={language} unknown={t.footer.unknown} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {items.some((item) => item.timestampFallback) ? <p className="timestamp-fallback-note">{t.footer.legacyTimestamp}</p> : null}
    </div>
  );
}

export function DataTrustFooter({
  t,
  language,
  freshnessItems = [],
  sources = [],
  methodology,
  limitations,
  failures = 0,
}) {
  const failureCount = Array.isArray(failures) ? failures.length : Number(failures) || 0;
  const sourceItems = sources.filter(Boolean);
  const methodologyText = textBlock(methodology) || t.footer.unknown;
  const limitationsText = textBlock(limitations) || t.footer.staticCacheOnly;
  return (
    <footer className="source-footer data-trust-footer">
      <div className="data-trust-top">
        <div>
          <strong>{t.footer.trustTitle}</strong>
          <span className={`data-trust-status ${failureCount ? "is-partial" : "is-healthy"}`}>
            {failureCount ? t.footer.partialStatus(failureCount) : t.footer.healthyStatus}
          </span>
        </div>
      </div>
      <FreshnessAuditTable items={freshnessItems} language={language} t={t} />
      <div className="data-trust-grid">
        <section>
          <small>{t.footer.sources}</small>
          <div className="data-trust-tags">
            {sourceItems.length ? sourceItems.map((source) => <span key={source}>{source}</span>) : <span>{t.footer.unknown}</span>}
          </div>
        </section>
        <section>
          <small>{t.footer.methodology}</small>
          <p>{methodologyText}</p>
        </section>
        <section>
          <small>{t.footer.limitations}</small>
          <p>{limitationsText}</p>
        </section>
      </div>
    </footer>
  );
}

export function PageNav({ page, t }) {
  return (
    <nav className="page-nav" aria-label="Page">
      <a className={page === "crypto" ? "is-active" : ""} aria-current={page === "crypto" ? "page" : undefined} href={appHashUrl()}>{t.nav.crypto}</a>
      <a className={page === "cryptoLiquidity" ? "is-active" : ""} aria-current={page === "cryptoLiquidity" ? "page" : undefined} href={appHashUrl("crypto-liquidity")}>{t.htmlLang === "en" ? "Crypto liquidity" : "\u52a0\u5bc6\u6d41\u52a8\u6027"}</a>
      <a className={page === "macro" ? "is-active" : ""} aria-current={page === "macro" ? "page" : undefined} href={appHashUrl("macro-calendar")}>{t.nav.macro}</a>
      <a className={page === "equity" ? "is-active" : ""} aria-current={page === "equity" ? "page" : undefined} href={appHashUrl("equity-macro")}>{t.nav.equity}</a>
      <a className={page === "marketClock" ? "is-active" : ""} aria-current={page === "marketClock" ? "page" : undefined} href={appHashUrl("market-clock")}>{t.nav.marketClock}</a>
      <a className={page === "chipChain" ? "is-active" : ""} aria-current={page === "chipChain" ? "page" : undefined} href={appHashUrl("chip-chain")}>{t.nav.chipChain}</a>
      <a className={page === "robotChain" ? "is-active" : ""} aria-current={page === "robotChain" ? "page" : undefined} href={appHashUrl("robot-chain")}>{t.nav.robotChain}</a>
      {ADMIN_PAGE_ENABLED ? <a className={page === "macroAdmin" ? "is-active" : ""} aria-current={page === "macroAdmin" ? "page" : undefined} href={appHashUrl("admin/macro-events")}>{t.nav.admin || "Admin"}</a> : null}
    </nav>
  );
}

export function AssetSwitch({ value, onChange, t }) {
  return (
    <div className="asset-switch" role="group" aria-label={t.controls.asset}>
      {ASSETS.map((asset) => (
        <button
          type="button"
          key={asset.symbol}
          className={`${asset.accent} ${value === asset.symbol ? "is-active" : ""}`}
          aria-pressed={value === asset.symbol}
          onClick={() => onChange(asset.symbol)}
        >
          <strong>{asset.symbol}</strong>
          <span>{asset.name}</span>
        </button>
      ))}
    </div>
  );
}

export function yearBackground(index, count) {
  const ratio = count > 1 ? 1 - index / (count - 1) : 0;
  return `rgb(${Math.round(255 - 70 * ratio)}, ${Math.round(255 - 38 * ratio)}, 255)`;
}

export function HeatCell({
  symbol,
  monthKey,
  row,
  value,
  rowKey,
  columnKey,
  hover,
  setHover,
  setTooltip,
  onSelect,
  showNA = true,
  t,
}) {
  const isHalving = HALVING_MONTHS.has(monthKey);
  const classNames = [
    "heat-cell",
    returnClass(value),
    isHalving ? "halving-cell" : "",
    hover?.rowKey === rowKey ? "cross-row" : "",
    hover?.columnKey === columnKey ? "cross-column" : "",
  ].filter(Boolean).join(" ");
  const label = `${symbol} ${monthKey} ${Number.isFinite(value) ? formatPct(value) : t.tables.noData}`;

  const revealTooltip = (event) => {
    setTooltip({ x: event.clientX, y: event.clientY, symbol, monthKey, row, value });
  };

  const activate = () => {
    if (row) {
      setTooltip(null);
      onSelect({ symbol, monthKey, row, value });
    }
  };

  return (
    <td
      className={classNames}
      tabIndex={row ? 0 : -1}
      role={row ? "button" : undefined}
      aria-label={label}
      onMouseEnter={(event) => {
        setHover({ rowKey, columnKey });
        revealTooltip(event);
      }}
      onMouseMove={revealTooltip}
      onMouseLeave={() => {
        setHover(null);
        setTooltip(null);
      }}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      {Number.isFinite(value) ? formatPct(value) : showNA ? "N/A" : ""}
    </td>
  );
}

export function TotalCell({
  symbol,
  year,
  row,
  value,
  rowKey,
  hover,
  setHover,
  setTooltip,
  onSelect,
  t,
}) {
  const classNames = [
    "total-cell",
    returnClass(value),
    hover?.rowKey === rowKey ? "cross-row" : "",
    hover?.columnKey === "total" ? "cross-column" : "",
  ].filter(Boolean).join(" ");
  const yearKey = String(year);
  const label = `${symbol} ${yearKey} ${Number.isFinite(value) ? formatPct(value) : t.tables.noData}`;

  const revealTooltip = (event) => {
    if (row) {
      setTooltip({ x: event.clientX, y: event.clientY, symbol, monthKey: yearKey, year: yearKey, row, value, period: "year" });
    }
  };

  const activate = () => {
    if (row) {
      setTooltip(null);
      onSelect({ symbol, monthKey: yearKey, year: yearKey, row, value, period: "year" });
    }
  };

  return (
    <td
      className={classNames}
      tabIndex={row ? 0 : -1}
      role={row ? "button" : undefined}
      aria-label={label}
      onMouseEnter={(event) => {
        setHover({ rowKey, columnKey: "total" });
        revealTooltip(event);
      }}
      onMouseMove={revealTooltip}
      onMouseLeave={() => {
        setHover(null);
        setTooltip(null);
      }}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      {Number.isFinite(value) ? formatPct(value, 0) : ""}
    </td>
  );
}

export function LatestStrip({ dataset, onOpenAsset, t }) {
  return (
    <div className="latest-strip" aria-label={t.latest.aria}>
      {ASSETS.map((asset) => {
        const meta = dataset.assets[asset.symbol];
        const row = meta.rows[meta.rows.length - 1];
        const spot = meta.spot;
        const spotPrice = Number.isFinite(Number(spot?.price)) ? Number(spot.price) : row.close;
        const note = [
          row.monthKey,
          row.isClosed ? null : t.latest.inMonth,
        ].filter(Boolean).join(t.separator);
        return (
          <button type="button" key={asset.symbol} onClick={() => onOpenAsset(asset.symbol)}>
            <span className={`ticker ${asset.accent}`}>{asset.symbol}</span>
            <span className="latest-price"><span className="spot-prefix">{t.latest.spot}</span> {formatPrice(spotPrice, meta.quote)}</span>
            <span className={`latest-return ${row.pct >= 0 ? "positive" : "negative"}`}>{formatPct(row.pct, 2)}</span>
            <small>{note}</small>
          </button>
        );
      })}
    </div>
  );
}

export function AssetSpotSummary({ dataset, symbol, t }) {
  const meta = dataset.assets[symbol];
  if (!meta) return null;
  const asset = ASSETS.find((item) => item.symbol === symbol);
  const row = meta.rows[meta.rows.length - 1];
  const spot = meta.spot;
  const spotPrice = Number.isFinite(Number(spot?.price)) ? Number(spot.price) : row.close;
  const note = [
    row.monthKey,
    row.isClosed ? null : t.latest.inMonth,
  ].filter(Boolean).join(t.separator);

  return (
    <div className="asset-spot-summary" aria-label={`${symbol} ${t.latest.spot}`}>
      <span className={`ticker ${asset?.accent || ""}`}>{symbol}</span>
      <span className="latest-price"><span className="spot-prefix">{t.latest.spot}</span> {formatPrice(spotPrice, meta.quote)}</span>
      <span className={`latest-return ${row.pct >= 0 ? "positive" : "negative"}`}>{formatPct(row.pct, 2)}</span>
      <small>{note}</small>
    </div>
  );
}

export function CryptoInsight({ view, metric, range, asset, dataset, rotationRows, selected, t }) {
  const metricLabel = optionLabel(t.options.metrics, metric);
  const viewLabel = optionLabel(t.options.views, view);
  const rangeLabel = view === "rotation" ? optionLabel(t.options.ranges, range) : null;
  let title = "";
  let body = "";

  if (selected?.row) {
    const quote = dataset.assets[selected.symbol]?.quote || "USD";
    title = t.insight.selectedTitle(selected.symbol, selected.monthKey);
    body = t.insight.selectedBody(
      formatPct(selected.value, 2),
      formatPrice(selected.row.high, quote),
      formatPrice(selected.row.low, quote),
      formatPct(selected.row.extremeMovePct, 2),
    );
  } else if (view === "rotation") {
    const latest = rotationRows[0];
    title = t.insight.rotationTitle;
    body = t.insight.rotationBody(
      latest?.leader,
      latest?.ranking?.map((item, index) => `${index + 1}.${item.symbol}`).join("  "),
    );
  } else {
    const rows = dataset.assets[asset]?.rows || [];
    const latest = rows.at(-1);
    title = t.insight.cycleTitle(asset);
    body = t.insight.cycleBody(
      asset,
      formatPct(latest?.pct, 2),
      formatPct(latest?.extremeMovePct, 2),
    );
  }

  return (
    <section className="insight-card" aria-label={t.insight.label}>
      <div>
        <small>{t.insight.label}</small>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <div className="insight-meta">
        <span>{viewLabel}</span>
        <span>{metricLabel}</span>
        {rangeLabel ? <span>{rangeLabel}</span> : null}
        <small>{t.insight.shareHint}</small>
        <small>{t.insight.mobileHint}</small>
      </div>
    </section>
  );
}

export function MobilePinnedDetail({ selected, dataset, metric, onClear, t }) {
  if (!selected?.row) return null;
  const quote = dataset.assets[selected.symbol]?.quote || "USD";
  const extreme = extremeMoveMeta(selected.row, t);
  const extremeCaption = [extreme.label, extreme.order].filter(Boolean).join(t.separator);
  const isAnnual = selected.period === "year";
  const selectedLabel = isAnnual ? selected.year || selected.monthKey : selected.monthKey;
  return (
    <aside className="mobile-detail-dock" aria-live="polite">
      <button type="button" className="dock-close" onClick={onClear} aria-label={t.detail.closePinned}>×</button>
      <div>
        <small>{isAnnual ? t.detail.selectedYear : t.detail.selectedMonth}</small>
        <strong>{selected.symbol}{t.separator}{selectedLabel}</strong>
      </div>
      <div>
        <small>{isAnnual ? (metric === "absolute" ? t.detail.annualReturn : t.detail.relativeBtc) : metric === "absolute" ? t.detail.monthlyReturn : t.detail.relativeBtc}</small>
        <strong className={selected.value >= 0 ? "positive" : "negative"}>{formatPct(selected.value, 2)}</strong>
      </div>
      <div>
        <small>{t.detail.high} / {t.detail.low}</small>
        <strong>{formatPrice(selected.row.high, quote)} / {formatPrice(selected.row.low, quote)}</strong>
      </div>
      <div>
        <small>{extremeCaption}</small>
        <strong className={extreme.className}>{formatPct(selected.row.extremeMovePct, 2)}</strong>
      </div>
    </aside>
  );
}

export function RotationTable({ rows, metric, hover, setHover, setTooltip, onSelect, t }) {
  return (
    <div className="table-shell rotation-shell">
      <table className="data-table rotation-table">
        <caption className="sr-only">{t.tables.rotationCaption}</caption>
        <thead>
          <tr>
            <th className="month-column">{t.tables.month}</th>
            {ASSETS.map((asset) => <th key={asset.symbol} className={hover?.columnKey === asset.symbol ? "cross-column" : ""}>{asset.symbol}</th>)}
            <th>{t.tables.leader}</th>
            <th>{t.tables.cycleBackground}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, rowIndex) => (
            <tr key={item.monthKey} className={rowIndex > 0 && rows[rowIndex - 1].year !== item.year ? "year-break" : ""}>
              <th scope="row" className={hover?.rowKey === item.monthKey ? "cross-row" : ""}>{item.monthKey}</th>
              {ASSETS.map((asset) => {
                const cell = item.cells[asset.symbol];
                return (
                  <HeatCell
                    key={asset.symbol}
                    symbol={asset.symbol}
                    monthKey={item.monthKey}
                    row={cell.row}
                    value={cell.value}
                    rowKey={item.monthKey}
                    columnKey={asset.symbol}
                    hover={hover}
                    setHover={setHover}
                    setTooltip={setTooltip}
                    onSelect={(selected) => onSelect({ ...selected, ranking: item.ranking })}
                    t={t}
                  />
                );
              })}
              <td className={`leader-cell ${item.leader ? `asset-${item.leader.toLowerCase()}` : ""}`}>{item.leader || "N/A"}</td>
              <td className={`cycle-cell ${item.cycle.className}`}>{cycleLabel(item.cycle, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-note">
        {metric === "absolute" ? t.tables.absoluteNote : t.tables.relativeNote}
      </div>
    </div>
  );
}

export function CycleTable({ years, stats, asset, currentMonthKey, hover, setHover, setTooltip, onSelect, t }) {
  return (
    <div className="table-shell cycle-shell">
      <table className="data-table cycle-table">
        <caption className="sr-only">{t.tables.cycleCaption(asset)}</caption>
        <thead>
          <tr>
            <th>{t.tables.year}</th>
            {t.months.map((month, index) => <th key={month} className={hover?.columnKey === index ? "cross-column" : ""}>{month}</th>)}
            <th className="gap-column" aria-hidden="true"></th>
            <th className={hover?.columnKey === "total" ? "cross-column" : ""}>{t.tables.total}</th>
            <th>{t.tables.cycle}</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year, index) => (
            <Fragment key={year.year}>
              <tr>
                <th
                  scope="row"
                  className={hover?.rowKey === String(year.year) ? "cross-row" : ""}
                  style={{ backgroundColor: yearBackground(index, years.length) }}
                >
                  {year.year}
                </th>
                {year.months.map((month, monthIndex) => (
                  <HeatCell
                    key={month.monthKey}
                    symbol={asset}
                    monthKey={month.monthKey}
                    row={month.row}
                    value={month.value}
                    rowKey={String(year.year)}
                    columnKey={monthIndex}
                    hover={hover}
                    setHover={setHover}
                    setTooltip={setTooltip}
                    onSelect={onSelect}
                    showNA={month.monthKey < currentMonthKey}
                    t={t}
                  />
                ))}
                <td className="gap-column"></td>
                <TotalCell
                  symbol={asset}
                  year={year.year}
                  row={year.totalRow}
                  value={year.totalValue}
                  rowKey={String(year.year)}
                  hover={hover}
                  setHover={setHover}
                  setTooltip={setTooltip}
                  onSelect={onSelect}
                  t={t}
                />
                <td className={`cycle-cell ${year.cycle.className}`}>{cycleLabel(year.cycle, t)}</td>
              </tr>
              {isCycleGroupStartYear(year.year) && index < years.length - 1 ? (
                <tr className="cycle-gap" aria-hidden="true"><td colSpan="16"></td></tr>
              ) : null}
            </Fragment>
          ))}
          <tr className="stats-divider" aria-hidden="true"><td colSpan="16"></td></tr>
          <tr className="stats-row">
            <th scope="row">{t.tables.median}</th>
            {stats.median.map((value, index) => <td key={index} className={returnClass(value)}>{Number.isFinite(value) ? formatPct(value, 0) : ""}</td>)}
            <td className="gap-column"></td><td></td><td></td>
          </tr>
          <tr className="stats-row">
            <th scope="row">{t.tables.average}</th>
            {stats.average.map((value, index) => <td key={index} className={returnClass(value)}>{Number.isFinite(value) ? formatPct(value, 0) : ""}</td>)}
            <td className="gap-column"></td><td></td><td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function DetailBand({ selected, dataset, metric, t }) {
  if (!selected) {
    return (
      <aside className="detail-band detail-empty" aria-live="polite">
        <strong>{t.detail.title}</strong>
        <span>{t.detail.empty}</span>
      </aside>
    );
  }
  const meta = dataset.assets[selected.symbol];
  const extreme = extremeMoveMeta(selected.row, t);
  const extremeCaption = [extreme.label, extreme.order].filter(Boolean).join(t.separator);
  const isAnnual = selected.period === "year";
  const selectedLabel = isAnnual ? selected.year || selected.monthKey : selected.monthKey;
  return (
    <aside className="detail-band" aria-live="polite">
      <div>
        <small>{isAnnual ? t.detail.selectedYear : t.detail.selectedMonth}</small>
        <strong>{selectedLabel}{t.separator}{selected.symbol}</strong>
      </div>
      <div>
        <small>{isAnnual ? (metric === "absolute" ? t.detail.annualReturn : t.detail.relativeBtc) : metric === "absolute" ? t.detail.monthlyReturn : t.detail.relativeBtc}</small>
        <strong className={selected.value >= 0 ? "positive" : "negative"}>{formatPct(selected.value, 2)}</strong>
      </div>
      <div>
        <small>{t.detail.open}</small>
        <strong>{formatPrice(selected.row.open, meta.quote)}</strong>
      </div>
      <div>
        <small>{selected.row.isClosed ? t.detail.close : t.detail.currentPrice}</small>
        <strong>{formatPrice(selected.row.close, meta.quote)}</strong>
      </div>
      <div>
        <small>{t.detail.high}</small>
        <strong>{formatPrice(selected.row.high, meta.quote)}</strong>
      </div>
      <div>
        <small>{t.detail.low}</small>
        <strong>{formatPrice(selected.row.low, meta.quote)}</strong>
      </div>
      <div>
        <small>{extremeCaption}</small>
        <strong className={extreme.className}>{formatPct(selected.row.extremeMovePct, 2)}</strong>
      </div>
      <div>
        <small>{t.detail.status}</small>
        <strong>{selected.row.isClosed ? t.detail.closed : t.detail.live}</strong>
      </div>
      <div className="detail-source">
        <small>{t.detail.source}</small>
        <strong>{meta.sourceLabel}</strong>
      </div>
      {selected.ranking?.length ? (
        <div className="ranking-line">
          <small>{t.detail.ranking}</small>
          <strong>{selected.ranking.map((item, index) => `${index + 1}.${item.symbol}`).join("  ")}</strong>
        </div>
      ) : null}
    </aside>
  );
}

export function Tooltip({ value, dataset, t }) {
  if (!value?.row) return null;
  const quote = dataset.assets[value.symbol]?.quote || "USD";
  const extreme = extremeMoveMeta(value.row, t);
  const extremeCaption = [extreme.label, extreme.order].filter(Boolean).join(t.separator);
  const isAnnual = value.period === "year";
  const valueLabel = isAnnual ? value.year || value.monthKey : value.monthKey;
  return (
    <div
      className="cell-tooltip"
      style={{
        left: Math.max(8, Math.min(value.x + 14, window.innerWidth - 284)),
        top: Math.max(8, Math.min(value.y + 14, window.innerHeight - 190)),
      }}
    >
      <strong>{value.symbol}{t.separator}{valueLabel}</strong>
      <span>{isAnnual ? t.tooltip.annualReturn : t.tooltip.return} {formatPct(value.value, 2)}</span>
      <span>{t.tooltip.open} {formatPrice(value.row.open, quote)} / {value.row.isClosed ? t.tooltip.close : t.tooltip.currentPrice} {formatPrice(value.row.close, quote)}</span>
      <span>{t.tooltip.high} {formatPrice(value.row.high, quote)} / {t.tooltip.low} {formatPrice(value.row.low, quote)}</span>
      <span className={`tooltip-extreme ${extreme.className}`}>{extremeCaption} {formatPct(value.row.extremeMovePct, 2)}</span>
      <small>{value.row.isClosed ? t.tooltip.closed : t.tooltip.live}</small>
    </div>
  );
}

export function Legend({ t }) {
  const stops = [
    ["≤ -30%", -35], ["-20%", -20], ["-10%", -10], ["0%", 0], ["+10%", 10], ["+20%", 20], ["≥ +40%", 40],
  ];
  return (
    <div className="legend" aria-label={t.legend.aria}>
      <span>{t.legend.down}</span>
      {stops.map(([label, value]) => <span key={label} className={returnClass(value)}>{label}</span>)}
      <span>{t.legend.up}</span>
      <span className="halving-cell">{t.legend.halving}</span>
    </div>
  );
}

export function formatNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "N/A";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value));
}

export function plannedSourceLabel(language) {
  return language === "en" ? "Reviewed backend quote cache" : "经审查的后端行情缓存";
}

export function formatSignedNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "N/A";
  const normalized = Math.abs(Number(value)) < 10 ** -digits ? 0 : Number(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    signDisplay: normalized === 0 ? "never" : "always",
  }).format(normalized);
}

export function formatCompactPrice(value) {
  if (!Number.isFinite(Number(value))) return "N/A";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value))} USD`;
}

export function formatBp(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return "N/A";
  const normalized = Math.abs(Number(value)) < 0.005 ? 0 : Number(value);
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(digits)} bp`;
}

export function latestMacro(week, id) {
  return week?.macro?.[id] || null;
}

export function macroClass(value) {
  if (!Number.isFinite(Number(value)) || Number(value) === 0) return "";
  return Number(value) > 0 ? "positive" : "negative";
}

export function isMacroNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

export function macroMoveClass(value) {
  if (!isMacroNumber(value) || Number(value) === 0) return "";
  return Number(value) > 0 ? "macro-up" : "macro-down";
}

export function macroCategoryLabel(category, t) {
  if (category === "all") return t.macroCalendar.all;
  if (category === "liquidity") return t.macroCalendar.liquidity;
  if (category === "sell-pressure-exhausted") return t.macroCalendar.sellPressureExhausted;
  return t.macroCalendar.categories[category] || category;
}

export function compactMacroCategoryLabel(category, t) {
  return t.macroCalendar.compactCategories?.[category] || macroCategoryLabel(category, t);
}

export function macroDateMeaningLabel(value, t) {
  if (value === "observation_period" || value === "observation_week") return t.macroCalendar.observationPeriod;
  if (value === "daily_observation") return t.macroCalendar.dailyObservation;
  if (value === "projection_year") return t.macroCalendar.projectionYear;
  if (value === "sep_release_observation") return t.macroCalendar.sepProjection;
  if (value === "scheduled_beijing_date") return t.macroCalendar.scheduledBeijingDate;
  if (value === "observed_holiday_date") return t.macroCalendar.observedHolidayDate;
  return value || "N/A";
}

export function formatMacroValue(value, unit) {
  if (!isMacroNumber(value)) return "N/A";
  if (unit === "percent" || unit === "percent_spread") return `${formatNumber(value, 2)}%`;
  if (unit === "thousand_persons") return `${formatNumber(value, 0)}K`;
  if (unit === "persons") return formatNumber(value, 0);
  if (unit === "usd_millions") return `$${formatNumber(Number(value) / 1000, 1)}B`;
  if (unit === "usd_billions" || unit === "usd_billions_chained") return `$${formatNumber(value, 1)}B`;
  if (unit === "usd_per_hour") return `$${formatNumber(value, 2)}`;
  return formatNumber(value, unit === "fx" ? 4 : 2);
}

export function formatMacroChange(item) {
  if (!item) return "N/A";
  if (isMacroNumber(item.changeBp)) return formatBp(item.changeBp, 0);
  if (item.unit === "thousand_persons" && isMacroNumber(item.change)) return `${formatSignedNumber(item.change, 0)}K`;
  if (item.unit === "persons" && isMacroNumber(item.change)) return formatSignedNumber(item.change, 0);
  if (item.unit === "usd_millions" && isMacroNumber(item.change)) return `$${formatSignedNumber(Number(item.change) / 1000, 1)}B`;
  if ((item.unit === "usd_billions" || item.unit === "usd_billions_chained") && isMacroNumber(item.change)) return `$${formatSignedNumber(item.change, 1)}B`;
  if (isMacroNumber(item.pctChange)) return formatPct(item.pctChange, 2);
  if (isMacroNumber(item.change)) return formatSignedNumber(item.change, 2);
  return "N/A";
}
