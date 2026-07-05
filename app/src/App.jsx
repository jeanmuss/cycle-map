import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ASSETS,
  HALVING_MONTHS,
  appHashUrl,
  appUrl,
  buildCycleYears,
  buildRotationRows,
  formatPct,
  formatPrice,
  freshnessLabel,
  isCycleGroupStartYear,
  makeAssetMaps,
  monthlyStats,
  routePathname,
  returnClass,
} from "./data.js";

const DEFAULT_CRYPTO_STATE = {
  view: "cycle",
  metric: "absolute",
  range: "48",
  asset: "BTC",
};

const DEFAULT_EQUITY_STATE = {
  range: "52",
};

const DEFAULT_MACRO_STATE = {
  category: "all",
};

const DEFAULT_CHIP_CHAIN_STATE = {
  range: "1d",
};

const DEFAULT_ROBOT_CHAIN_STATE = {
  range: "1d",
};

const VALID_CRYPTO_VIEWS = new Set(["rotation", "cycle"]);
const VALID_CRYPTO_METRICS = new Set(["absolute", "relative"]);
const VALID_CRYPTO_RANGES = new Set(["12", "24", "48", "all"]);
const VALID_ASSETS = new Set(ASSETS.map((asset) => asset.symbol));
const VALID_EQUITY_RANGES = new Set(["26", "52", "all"]);
const VALID_MACRO_CATEGORIES = new Set(["all", "inflation", "growth", "rates", "volatility", "liquidity"]);
const VALID_CHIP_CHAIN_RANGES = new Set(["1d", "5d", "1m", "3m"]);
const VALID_ROBOT_CHAIN_RANGES = new Set(["1d", "5d", "1m", "3m"]);

const MACRO_CALENDAR_TIME_ZONES = {
  zh: "Asia/Shanghai",
  en: "America/New_York",
};

const EQUITY_MARKET_TEXT = {
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
    tenYear: "10Y",
    vix: "VIX",
    open: "\u5f00",
    currentPrice: "\u73b0\u4ef7",
    close: "\u6536",
    dayMove: "\u6da8\u8dcc",
    priceIndicators: "\u89c2\u5bdf\u6307\u6807",
    marketClosed: "\u7f8e\u80a1\u4f11\u5e02",
    macro: "\u5229\u7387 / \u6ce2\u52a8",
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
    priceSourceNote: "\u4ef7\u683c\u6765\u81ea AKShare/Sina \u7f8e\u80a1\u65e5\u7ebf\uff0cDOW \u4f7f\u7528 DIA ETF \u4ee3\u7406\uff1b10Y\u3001VIX\u3001USD/CNY \u548c\u9ec4\u91d1\u6307\u6570\u4ee3\u7406\u6765\u81ea FRED\uff0c\u52a0\u5bc6\u5e02\u503c\u6765\u81ea CMC\u3002\u524d\u7aef\u53ea\u8bfb\u53d6\u9759\u6001\u7f13\u5b58\u3002",
    methodology: "\u65e5\u5386\u884c\u5408\u5e76\u7f13\u5b58\u7684 QQQ/SPY/DIA \u65e5\u7ebf OHLC \u4e0e FRED 10Y/VIX/USD-CNY \u89c2\u6d4b\uff1b\u9876\u90e8\u5feb\u5361\u6765\u81ea\u5355\u72ec\u7684\u5feb\u7f13\u5b58\u3002",
    eventPlaceholder: "\u672c\u9875\u6682\u4e0d\u63a5\u5165\u4e8b\u4ef6\u6ce8\u91ca\u3002",
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
    tenYear: "10Y",
    vix: "VIX",
    open: "Open",
    currentPrice: "Current",
    close: "Close",
    dayMove: "Move",
    priceIndicators: "Observations",
    marketClosed: "Market closed",
    macro: "Rates / volatility",
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
    priceSourceNote: "Prices use AKShare/Sina U.S. daily data; DOW uses DIA as an ETF proxy. 10Y, VIX, USD/CNY, and the gold proxy use FRED; crypto market caps use CMC. The frontend reads static cache only.",
    methodology: "Calendar rows combine cached QQQ/SPY/DIA daily OHLC with FRED 10Y/VIX/USD-CNY observations; summary cards use a separate fast cache.",
    eventPlaceholder: "No event annotation source is connected for this page yet.",
  },
};

function equityCopy(t) {
  return t.htmlLang === "zh-CN" ? EQUITY_MARKET_TEXT.zh : EQUITY_MARKET_TEXT.en;
}

const MARKET_CLOCK_TEXT = {
  zh: {
    docTitle: "全球市场开市轮动",
    docDescription: "加密、美股、韩股与中国风险市场的开市状态、价格和市值轮动视图",
    eyebrow: "GLOBAL MARKET CLOCK",
    titleAccent: "全球市场",
    titleRest: "开市轮动",
    subtitle: "用开市状态、代理价格和数据质量提示感知中美韩与加密风险市场的日内轮动",
    cache: "市场快照",
    cacheTooltip: "页面只读取后台生成的 market-session.json。CMC 和交易所 API 只在本地或 CI 脚本中使用，密钥不会进入浏览器。",
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
    alwaysOpen: "24小时交易",
    sourceNote: "价格优先使用公开行情快照；美股和 CL 可使用 OKX 合约/指数代理，旁边会标注数据质量。",
    methodology: "\u9875\u9762\u8bfb\u53d6 market-session.json\uff1b\u5f00\u95ed\u5e02\u72b6\u6001\u7531\u672c\u5730\u65f6\u533a\u548c\u4ea4\u6613\u65f6\u6bb5\u89c4\u5219\u8ba1\u7b97\u3002\u4e2d\u56fd\u5e02\u573a\u533a\u5206\u96c6\u5408\u7ade\u4ef7\u3001\u76d8\u4e2d\u3001\u6536\u76d8\u96c6\u5408\u7ade\u4ef7\u548c\u76d8\u540e\u65f6\u6bb5\uff1b\u97e9\u56fd\u5e02\u573a\u533a\u5206\u76d8\u524d\u3001\u76d8\u4e2d\u548c\u76d8\u540e\u3002",
    status: {
      open: "盘中",
      trading: "交易中",
      premarket: "盘前",
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
    cacheTooltip: "The page reads generated market-session.json only. CMC and exchange APIs run in local or CI scripts; credentials never reach the browser.",
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
    alwaysOpen: "24/7 trading",
    sourceNote: "Prices use public market snapshots where available; U.S. equities and CL may use clearly labeled OKX proxy contracts or index prices.",
    methodology: "The page reads market-session.json; session status is computed from local time-zone and session rules. China distinguishes call auction, regular trading, closing auction, and after-hours blocks; Korea distinguishes pre-market, regular, and after-hours sessions.",
    status: {
      open: "Open",
      trading: "Trading",
      premarket: "Pre-market",
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

function marketClockCopy(t) {
  return t.htmlLang === "zh-CN" ? MARKET_CLOCK_TEXT.zh : MARKET_CLOCK_TEXT.en;
}

const CHIP_CHAIN_TEXT = {
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
    stage: {
      Upstream: "Upstream",
      Middle: "Middle",
      Downstream: "Downstream",
    },
  },
};

function chipChainCopy(t) {
  return t.htmlLang === "zh-CN" ? CHIP_CHAIN_TEXT.zh : CHIP_CHAIN_TEXT.en;
}

const ROBOT_CHAIN_TEXT = {
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

function robotChainCopy(t) {
  return t.htmlLang === "zh-CN" ? ROBOT_CHAIN_TEXT.zh : ROBOT_CHAIN_TEXT.en;
}

function hashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  const rawHash = window.location.hash.replace(/^#/, "");
  const queryIndex = rawHash.indexOf("?");
  return new URLSearchParams(queryIndex >= 0 ? rawHash.slice(queryIndex + 1) : "");
}

function readCryptoStateFromHash() {
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

function readEquityStateFromHash() {
  const params = hashParams();
  const range = params.get("range");
  return {
    range: VALID_EQUITY_RANGES.has(range) ? range : DEFAULT_EQUITY_STATE.range,
  };
}

function readMacroStateFromHash() {
  const params = hashParams();
  const category = params.get("category");
  return {
    category: VALID_MACRO_CATEGORIES.has(category) ? category : DEFAULT_MACRO_STATE.category,
  };
}

function readChipChainStateFromHash() {
  const params = hashParams();
  const range = params.get("range");
  return {
    range: VALID_CHIP_CHAIN_RANGES.has(range) ? range : DEFAULT_CHIP_CHAIN_STATE.range,
  };
}

function readRobotChainStateFromHash() {
  const params = hashParams();
  const range = params.get("range");
  return {
    range: VALID_ROBOT_CHAIN_RANGES.has(range) ? range : DEFAULT_ROBOT_CHAIN_STATE.range,
  };
}

function replaceHashState(path, state) {
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

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

const TRANSLATIONS = {
  zh: {
    htmlLang: "zh-CN",
    docTitle: "风险资产周期与轮动图",
    docDescription: "BTC、ETH、SOL、HYPE 月度收益周期与轮动可视化",
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
      subtitle: "按月观察 BTC、ETH、SOL、HYPE 的涨跌规律与轮动关系",
      cache: "本地缓存",
      cacheTooltip: "页面读取的是已保存的静态行情快照；现价和月线由后台定时更新，浏览器不会直接连接交易所或暴露密钥。",
      failure: (count) => `上游异常：${count}`,
      success: "四个来源更新成功",
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
      rotationCaption: "四币月度收益轮动总览",
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
      monthlyReturn: "月度收益",
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
      updated: "\u66f4\u65b0\u65f6\u95f4",
      sources: "\u6765\u6e90",
      methodology: "\u65b9\u6cd5",
      limitations: "\u9650\u5236\u8bf4\u660e",
      healthyStatus: "\u5df2\u751f\u6210\u6700\u65b0\u7f13\u5b58",
      partialStatus: (count) => `\u6709 ${count} \u9879\u4e0a\u6e38\u63d0\u793a\uff0c\u5f53\u524d\u663e\u793a\u5df2\u751f\u6210\u7f13\u5b58`,
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
    docDescription: "Monthly return cycle and rotation visualization for BTC, ETH, SOL, and HYPE",
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
      subtitle: "Track monthly return patterns and rotation across BTC, ETH, SOL, and HYPE",
      cache: "Local cache",
      cacheTooltip: "The page reads a saved static market snapshot. Scheduled backend jobs refresh prices and monthly data; the browser never connects to exchanges with credentials.",
      failure: (count) => `Upstream issues: ${count}`,
      success: "All four sources updated",
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
      rotationCaption: "Monthly return rotation overview for four assets",
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
      monthlyReturn: "Monthly return",
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
      updated: "Updated",
      sources: "Sources",
      methodology: "Methodology",
      limitations: "Limitations",
      healthyStatus: "Latest cache generated",
      partialStatus: (count) => `${count} upstream note${count === 1 ? "" : "s"}; showing the generated cache`,
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

function getInitialLanguage() {
  if (typeof window === "undefined") return "zh";
  try {
    const stored = window.localStorage.getItem("cycle-map-language");
    return stored === "en" || stored === "zh" ? stored : "zh";
  } catch {
    return "zh";
  }
}

function cycleLabel(cycle, t) {
  return t.cycle[cycle?.className] || cycle?.label || "";
}

function extremeMoveMeta(row, t) {
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

function Segmented({ label, options, value, onChange, compact = false }) {
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

function LanguageToggle({ language, onChange, t }) {
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

function CacheStatus({ label, tooltip }) {
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

function textBlock(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  return value || "";
}

function DataTrustFooter({
  t,
  language,
  generatedAt,
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
        <dl>
          <div>
            <dt>{t.footer.updated}</dt>
            <dd>{generatedAt ? freshnessLabel(generatedAt, language) : t.footer.unknown}</dd>
          </div>
        </dl>
      </div>
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

function PageNav({ page, t }) {
  return (
    <nav className="page-nav" aria-label="Page">
      <a className={page === "crypto" ? "is-active" : ""} aria-current={page === "crypto" ? "page" : undefined} href={appHashUrl()}>{t.nav.crypto}</a>
      <a className={page === "macro" ? "is-active" : ""} aria-current={page === "macro" ? "page" : undefined} href={appHashUrl("macro-calendar")}>{t.nav.macro}</a>
      <a className={page === "equity" ? "is-active" : ""} aria-current={page === "equity" ? "page" : undefined} href={appHashUrl("equity-macro")}>{t.nav.equity}</a>
      <a className={page === "marketClock" ? "is-active" : ""} aria-current={page === "marketClock" ? "page" : undefined} href={appHashUrl("market-clock")}>{t.nav.marketClock}</a>
      <a className={page === "chipChain" ? "is-active" : ""} aria-current={page === "chipChain" ? "page" : undefined} href={appHashUrl("chip-chain")}>{t.nav.chipChain}</a>
      <a className={page === "robotChain" ? "is-active" : ""} aria-current={page === "robotChain" ? "page" : undefined} href={appHashUrl("robot-chain")}>{t.nav.robotChain}</a>
    </nav>
  );
}

function AssetSwitch({ value, onChange, t }) {
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

function yearBackground(index, count) {
  const ratio = count > 1 ? 1 - index / (count - 1) : 0;
  return `rgb(${Math.round(255 - 70 * ratio)}, ${Math.round(255 - 38 * ratio)}, 255)`;
}

function HeatCell({
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

function LatestStrip({ dataset, onOpenAsset, t }) {
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

function AssetSpotSummary({ dataset, symbol, t }) {
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

function CryptoInsight({ view, metric, range, asset, dataset, rotationRows, selected, t }) {
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

function MobilePinnedDetail({ selected, dataset, metric, onClear, t }) {
  if (!selected?.row) return null;
  const quote = dataset.assets[selected.symbol]?.quote || "USD";
  const extreme = extremeMoveMeta(selected.row, t);
  const extremeCaption = [extreme.label, extreme.order].filter(Boolean).join(t.separator);
  return (
    <aside className="mobile-detail-dock" aria-live="polite">
      <button type="button" className="dock-close" onClick={onClear} aria-label={t.detail.closePinned}>×</button>
      <div>
        <small>{t.detail.selectedMonth}</small>
        <strong>{selected.symbol}{t.separator}{selected.monthKey}</strong>
      </div>
      <div>
        <small>{metric === "absolute" ? t.detail.monthlyReturn : t.detail.relativeBtc}</small>
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

function RotationTable({ rows, metric, hover, setHover, setTooltip, onSelect, t }) {
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

function CycleTable({ years, stats, asset, currentMonthKey, hover, setHover, setTooltip, onSelect, t }) {
  return (
    <div className="table-shell cycle-shell">
      <table className="data-table cycle-table">
        <caption className="sr-only">{t.tables.cycleCaption(asset)}</caption>
        <thead>
          <tr>
            <th>{t.tables.year}</th>
            {t.months.map((month, index) => <th key={month} className={hover?.columnKey === index ? "cross-column" : ""}>{month}</th>)}
            <th className="gap-column" aria-hidden="true"></th>
            <th>{t.tables.total}</th>
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
                <td className={`total-cell ${returnClass(year.totalValue)}`}>{Number.isFinite(year.totalValue) ? formatPct(year.totalValue, 0) : ""}</td>
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

function DetailBand({ selected, dataset, metric, t }) {
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
  return (
    <aside className="detail-band" aria-live="polite">
      <div>
        <small>{t.detail.selectedMonth}</small>
        <strong>{selected.monthKey}{t.separator}{selected.symbol}</strong>
      </div>
      <div>
        <small>{metric === "absolute" ? t.detail.monthlyReturn : t.detail.relativeBtc}</small>
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

function Tooltip({ value, dataset, t }) {
  if (!value?.row) return null;
  const quote = dataset.assets[value.symbol]?.quote || "USD";
  const extreme = extremeMoveMeta(value.row, t);
  const extremeCaption = [extreme.label, extreme.order].filter(Boolean).join(t.separator);
  return (
    <div
      className="cell-tooltip"
      style={{
        left: Math.max(8, Math.min(value.x + 14, window.innerWidth - 284)),
        top: Math.max(8, Math.min(value.y + 14, window.innerHeight - 190)),
      }}
    >
      <strong>{value.symbol}{t.separator}{value.monthKey}</strong>
      <span>{t.tooltip.return} {formatPct(value.value, 2)}</span>
      <span>{t.tooltip.open} {formatPrice(value.row.open, quote)} / {value.row.isClosed ? t.tooltip.close : t.tooltip.currentPrice} {formatPrice(value.row.close, quote)}</span>
      <span>{t.tooltip.high} {formatPrice(value.row.high, quote)} / {t.tooltip.low} {formatPrice(value.row.low, quote)}</span>
      <span className={`tooltip-extreme ${extreme.className}`}>{extremeCaption} {formatPct(value.row.extremeMovePct, 2)}</span>
      <small>{value.row.isClosed ? t.tooltip.closed : t.tooltip.live}</small>
    </div>
  );
}

function Legend({ t }) {
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

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "N/A";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value));
}

function formatSignedNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "N/A";
  const normalized = Math.abs(Number(value)) < 10 ** -digits ? 0 : Number(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    signDisplay: normalized === 0 ? "never" : "always",
  }).format(normalized);
}

function formatCompactPrice(value) {
  if (!Number.isFinite(Number(value))) return "N/A";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value))} USD`;
}

function formatBp(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return "N/A";
  const normalized = Math.abs(Number(value)) < 0.005 ? 0 : Number(value);
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(digits)} bp`;
}

function latestMacro(week, id) {
  return week?.macro?.[id] || null;
}

function macroClass(value) {
  if (!Number.isFinite(Number(value)) || Number(value) === 0) return "";
  return Number(value) > 0 ? "positive" : "negative";
}

function isMacroNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function macroMoveClass(value) {
  if (!isMacroNumber(value) || Number(value) === 0) return "";
  return Number(value) > 0 ? "macro-up" : "macro-down";
}

function macroCategoryLabel(category, t) {
  if (category === "all") return t.macroCalendar.all;
  if (category === "liquidity") return t.macroCalendar.liquidity;
  if (category === "sell-pressure-exhausted") return t.macroCalendar.sellPressureExhausted;
  return t.macroCalendar.categories[category] || category;
}

function compactMacroCategoryLabel(category, t) {
  return t.macroCalendar.compactCategories?.[category] || macroCategoryLabel(category, t);
}

function macroDateMeaningLabel(value, t) {
  if (value === "observation_period" || value === "observation_week") return t.macroCalendar.observationPeriod;
  if (value === "daily_observation") return t.macroCalendar.dailyObservation;
  if (value === "projection_year") return t.macroCalendar.projectionYear;
  if (value === "sep_release_observation") return t.macroCalendar.sepProjection;
  if (value === "scheduled_beijing_date") return t.macroCalendar.scheduledBeijingDate;
  if (value === "observed_holiday_date") return t.macroCalendar.observedHolidayDate;
  return value || "N/A";
}

function formatMacroValue(value, unit) {
  if (!isMacroNumber(value)) return "N/A";
  if (unit === "percent" || unit === "percent_spread") return `${formatNumber(value, 2)}%`;
  if (unit === "thousand_persons") return `${formatNumber(value, 0)}K`;
  if (unit === "persons") return formatNumber(value, 0);
  if (unit === "usd_millions") return `$${formatNumber(Number(value) / 1000, 1)}B`;
  if (unit === "usd_billions" || unit === "usd_billions_chained") return `$${formatNumber(value, 1)}B`;
  if (unit === "usd_per_hour") return `$${formatNumber(value, 2)}`;
  return formatNumber(value, unit === "fx" ? 4 : 2);
}

function formatMacroChange(item) {
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

const MACRO_WEEK_ROWS = ["inflation", "growth", "rates", "volatility", "liquidity"];

const MACRO_STATUS_DISPLAY = {
  DFEDTARU: { category: "rates", label: "Fed upper", mode: "bp" },
  DFF: { category: "rates", label: "Fed funds", mode: "bp" },
  DGS2: { category: "rates", label: "2Y", mode: "bp" },
  DGS10: { category: "rates", label: "10Y", mode: "bp" },
  DFII10: { category: "rates", label: "Real 10Y", mode: "bp" },
  T10YIE: { category: "rates", label: "BEI", mode: "bp" },
  DTWEXBGS: { category: "rates", label: "DXY", mode: "pct" },
  DEXJPUS: { category: "rates", label: "USD/JPY", mode: "pct" },
  DEXCHUS: { category: "rates", label: "USD/CNY", mode: "pct" },
  VIXCLS: { category: "volatility", label: "VIX", mode: "level" },
  BAMLC0A0CM: { category: "volatility", label: "IG OAS", mode: "bp" },
  BAMLH0A0HYM2: { category: "volatility", label: "HY OAS", mode: "bp" },
  STLFSI4: { category: "volatility", label: "Stress", mode: "level" },
  WALCL: { category: "liquidity", label: "Fed assets", mode: "level" },
  WRESBAL: { category: "liquidity", label: "Reserves", mode: "level" },
  WTREGEN: { category: "liquidity", label: "TGA", mode: "level" },
  RRPONTSYD: { category: "liquidity", label: "RRP", mode: "level" },
};

const MACRO_CATEGORY_ORDER = ["inflation", "growth", "rates", "volatility", "liquidity"];
const MONTH_CELL_ITEM_LIMIT = 3;

function utcDateFromKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKeyFromUtc(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function calendarTimeZone(language) {
  return MACRO_CALENDAR_TIME_ZONES[language] || MACRO_CALENDAR_TIME_ZONES.zh;
}

function dateKeyInTimeZone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  if (!parts.year || !parts.month || !parts.day) return null;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDateKeyForLanguage(language, date = new Date()) {
  return dateKeyInTimeZone(date, calendarTimeZone(language)) || localDateKey(date);
}

function useAutoLocalDateKey() {
  const [todayKey, setTodayKey] = useState(localDateKey);

  useEffect(() => {
    const refreshTodayKey = () => {
      const nextKey = localDateKey();
      setTodayKey((current) => current === nextKey ? current : nextKey);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshTodayKey();
    };

    refreshTodayKey();
    const interval = window.setInterval(refreshTodayKey, 60000);
    window.addEventListener("focus", refreshTodayKey);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshTodayKey);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return todayKey;
}

function addUtcDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function startOfSundayWeek(dateKey) {
  const date = utcDateFromKey(dateKey);
  return addUtcDays(date, -date.getUTCDay());
}

function weekDaysFor(dateKey, language = "zh") {
  const start = startOfSundayWeek(dateKey);
  const todayKey = localDateKeyForLanguage(language);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addUtcDays(start, index);
    const itemDateKey = dateKeyFromUtc(date);
    return { date, dateKey: itemDateKey, dayIndex: index, isToday: itemDateKey === todayKey };
  });
}

function monthKeyFromDateKey(dateKey) {
  return String(dateKey || "").slice(0, 7);
}

function monthGrid(monthKey, language = "zh") {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const start = startOfSundayWeek(dateKeyFromUtc(first));
  const todayKey = localDateKeyForLanguage(language);
  const days = [];
  for (let index = 0; index < 42; index += 1) {
    const date = addUtcDays(start, index);
    const dateKey = dateKeyFromUtc(date);
    days.push({
      date,
      dateKey,
      inMonth: date.getUTCMonth() === first.getUTCMonth(),
      isToday: dateKey === todayKey,
      dayOfMonth: date.getUTCDate(),
    });
    if (index >= 34 && date >= last && date.getUTCDay() === 6) break;
  }
  return days;
}

function shiftMonth(monthKey, delta) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKeyFromDateKey(dateKeyFromUtc(date));
}

function monthTitle(monthKey, language) {
  const date = utcDateFromKey(`${monthKey}-01`);
  const locale = language === "en" ? "en-US" : "zh-CN";
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "long" }).format(date);
}

function dayLabel(dateKey) {
  return String(dateKey).slice(5).replace("-", "/");
}

function sameOrBefore(a, b) {
  return String(a) <= String(b);
}

function findCurrentWeeklyState(dataset) {
  const endDate = dataset?.window?.endDate;
  const rows = dataset?.weeklyState || [];
  return rows.find((row) => row.weekStart <= endDate && row.weekEnd >= endDate)
    || [...rows].reverse().find((row) => sameOrBefore(row.weekEnd, endDate))
    || rows.at(-1)
    || null;
}

function findWeeklyStateForDate(dataset, dateKey) {
  const rows = dataset?.weeklyState || [];
  return rows.find((row) => row.weekStart <= dateKey && row.weekEnd >= dateKey)
    || rows.find((row) => row.weekStart <= dateKey && row.weekEnd >= dateKeyFromUtc(addUtcDays(utcDateFromKey(dateKey), -1)))
    || null;
}

function macroEventLabel(event, t) {
  if (!event) return "N/A";
  const labels = t.macroCalendar.eventLabels || {};
  const prefixes = t.macroCalendar.eventLabelPrefixes || {};
  const seriesId = String(event.seriesId || "");
  const bySeries = labels[seriesId];
  if (bySeries) return bySeries;
  const prefixMatch = Object.entries(prefixes).find(([prefix]) => seriesId.startsWith(prefix));
  if (prefixMatch) return prefixMatch[1];
  return labels[event.label] || event.label || "N/A";
}

function compactIndicatorLabel(label, t) {
  const translated = t?.macroCalendar?.eventLabels?.[label] || label || "";
  const compactLabel = t?.macroCalendar?.compactEventLabels?.[translated];
  if (compactLabel) return compactLabel;
  const replacements = [
    ["Average hourly earnings", "AHE"],
    ["ADP private payrolls", "ADP"],
    ["Initial jobless claims", "Initial claims"],
    ["Industrial production", "Ind. production"],
    ["PCE price index", "PCE"],
    ["Core PPI goods", "Core PPI"],
    ["Unemployment rate", "Unemployment"],
    ["Nonfarm payrolls", "NFP"],
    ["Retail sales", "Retail"],
    ["Consumer sentiment", "Sentiment"],
    ["Japan overnight rate", "Japan O/N"],
    ["China 3M interbank rate", "China 3M"],
    ["FOMC fed funds median projection", "Dot median"],
    ["FOMC longer-run fed funds median", "Dot long-run"],
    ["FOMC meeting minutes", "FOMC minutes"],
    ["FOMC rate decision", "FOMC decision"],
    ["M2 money stock", "M2"],
    ["U.S. Independence Day holiday", "Independence Day"],
    ["U.S. federal holiday", "U.S. holiday"],
  ];
  return replacements.reduce((value, [from, to]) => value.replace(from, to), translated);
}

function compactEventLabel(event, t) {
  const label = macroEventLabel(event, t);
  const compactLabel = t.macroCalendar.compactEventLabels?.[label];
  return compactLabel || compactIndicatorLabel(label, t);
}

function eventWeekText(event, t) {
  return `${compactEventLabel(event, t)} ${formatMacroValue(event.actual, event.unit)}`;
}

function eventMonthText(event, t) {
  return compactEventLabel(event, t);
}

function statusChipText(seriesId, value) {
  const meta = MACRO_STATUS_DISPLAY[seriesId];
  if (!meta) return "";
  const changeText = meta.mode === "pct" && isMacroNumber(value.pctChange)
    ? formatPct(value.pctChange, 2)
    : formatMacroChange(value);
  return `${meta.label} ${changeText}`;
}

function statusItemsForWeek(week) {
  if (!week?.values) return [];
  return Object.entries(week.values)
    .map(([seriesId, value]) => {
      const meta = MACRO_STATUS_DISPLAY[seriesId];
      if (!meta || !value?.observationEnd) return null;
      return {
        type: "status",
        date: value.observationEnd,
        category: meta.category,
        label: meta.label,
        text: statusChipText(seriesId, value),
        value,
        seriesId,
      };
    })
    .filter(Boolean);
}

function statusItemsForDate(dataset, dateKey) {
  const itemsBySeries = new Map();
  (dataset?.weeklyState || []).forEach((week) => {
    statusItemsForWeek(week)
      .filter((item) => item.date === dateKey)
      .forEach((item) => {
        const existing = itemsBySeries.get(item.seriesId);
        if (!existing || (existing.value?.carriedForward && !item.value?.carriedForward)) {
          itemsBySeries.set(item.seriesId, item);
        }
      });
  });
  return [...itemsBySeries.values()].sort((a, b) => {
    const categoryDiff = MACRO_CATEGORY_ORDER.indexOf(a.category) - MACRO_CATEGORY_ORDER.indexOf(b.category);
    if (categoryDiff) return categoryDiff;
    return a.label.localeCompare(b.label);
  });
}

function flowItemsForDate(dateKey, t) {
  const date = utcDateFromKey(dateKey);
  const endOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  const daysToMonthEnd = Math.round((endOfMonth - date) / 86400000);
  const lastWorkingDay = new Date(endOfMonth.getTime());
  while (lastWorkingDay.getUTCDay() === 0 || lastWorkingDay.getUTCDay() === 6) {
    lastWorkingDay.setUTCDate(lastWorkingDay.getUTCDate() - 1);
  }
  const isQuarterEnd = [2, 5, 8, 11].includes(date.getUTCMonth());
  const isJulyEarningsSeasonWindow = date.getUTCMonth() === 6 && date.getUTCDate() >= 15 && date.getUTCDate() <= 31;
  const items = [];
  if (isJulyEarningsSeasonWindow) {
    items.push({
      type: "flow",
      date: dateKey,
      category: "volatility",
      label: t.macroCalendar.earningsSeasonWindow,
      text: t.macroCalendar.earningsSeason,
    });
  }
  if (daysToMonthEnd >= 0 && daysToMonthEnd <= 5) {
    items.push({
      type: "flow",
      date: dateKey,
      category: "liquidity",
      label: isQuarterEnd ? t.macroCalendar.quarterWindow : t.macroCalendar.monthWindow,
      text: isQuarterEnd ? t.macroCalendar.quarterWindow : t.macroCalendar.monthWindow,
    });
  }
  if (dateKey === dateKeyFromUtc(lastWorkingDay)) {
    items.push({
      type: "flow",
      date: dateKey,
      category: "sell-pressure-exhausted",
      label: t.macroCalendar.sellPressureExhausted,
      text: t.macroCalendar.sellPressureExhausted,
    });
  }
  return items;
}

function calendarDateKeyForEvent(event, language) {
  if (event?.releaseTimeUtc) {
    return dateKeyInTimeZone(event.releaseTimeUtc, calendarTimeZone(language)) || event.date;
  }
  return event?.date;
}

function eventsByDate(events, language = "zh") {
  return events.reduce((map, event) => {
    const dateKey = calendarDateKeyForEvent(event, language);
    if (!dateKey) return map;
    const list = map.get(dateKey) || [];
    list.push(event);
    map.set(dateKey, list);
    return map;
  }, new Map());
}

function isHolidayEvent(event) {
  return event?.role === "holiday";
}

function holidayCountryCode(event) {
  const country = String(event?.country || "").toUpperCase();
  if (country) return country;
  const seriesId = String(event?.seriesId || "");
  if (seriesId.startsWith("US_FEDERAL_HOLIDAY")) return "US";
  if (seriesId.startsWith("CN_PUBLIC_HOLIDAY")) return "CN";
  return "";
}

function holidayCountryLabel(countryCode, t) {
  return t.macroCalendar.countries?.[countryCode] || countryCode || "N/A";
}

function holidayCountryCodesForDate(eventMap, dateKey) {
  return [...new Set((eventMap.get(dateKey) || [])
    .filter(isHolidayEvent)
    .map(holidayCountryCode)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function buildWeekCellItems(dateKey, category, eventMap, statusItems, t) {
  const eventItems = (eventMap.get(dateKey) || [])
    .filter((event) => event.category === category)
    .map((event) => ({ type: "event", category, event, displayDate: dateKey, text: eventWeekText(event, t) }));
  const stateItems = statusItems
    .filter((item) => item.date === dateKey && item.category === category)
    .map((item) => ({ ...item, text: item.text }));
  const flowItems = flowItemsForDate(dateKey, t).filter((item) => item.category === category);
  return [...eventItems, ...stateItems, ...flowItems].slice(0, 4);
}

function buildWeekDayItems(dateKey, eventMap, statusItems, t) {
  const eventItems = (eventMap.get(dateKey) || []).map((event) => ({
    type: "event",
    category: event.category,
    event,
    displayDate: dateKey,
    text: eventWeekText(event, t),
  }));
  const stateItems = statusItems
    .filter((item) => item.date === dateKey)
    .map((item) => ({ ...item, text: item.text }));
  return [...eventItems, ...stateItems, ...flowItemsForDate(dateKey, t)];
}

function statusGroupItemsForDate(dataset, dateKey, t) {
  const groups = statusItemsForDate(dataset, dateKey).reduce((map, item) => {
    const existing = map.get(item.category) || {
      type: "status-group",
      category: item.category,
      count: 0,
    };
    existing.count += 1;
    map.set(item.category, existing);
    return map;
  }, new Map());

  return [...groups.values()]
    .sort((a, b) => MACRO_CATEGORY_ORDER.indexOf(a.category) - MACRO_CATEGORY_ORDER.indexOf(b.category))
    .map((item) => ({
      ...item,
      label: `${macroCategoryLabel(item.category, t)} ${item.count}`,
      text: `${compactMacroCategoryLabel(item.category, t)} ${item.count}`,
    }));
}

function monthItemWeight(item) {
  return item.type === "status-group" ? item.count : 1;
}

function limitMonthItems(items, t) {
  if (items.length <= MONTH_CELL_ITEM_LIMIT) return items;
  const visibleItems = items.slice(0, MONTH_CELL_ITEM_LIMIT - 1);
  const hiddenCount = items
    .slice(MONTH_CELL_ITEM_LIMIT - 1)
    .reduce((sum, item) => sum + monthItemWeight(item), 0);
  const hiddenText = t.macroCalendar.hiddenMonthItems(hiddenCount);
  return [
    ...visibleItems,
    {
      type: "overflow",
      category: "overflow",
      text: hiddenText,
      label: hiddenText,
    },
  ];
}

function buildMonthItems(dateKey, dataset, eventMap, t) {
  const eventItems = (eventMap.get(dateKey) || []).map((event) => ({
    type: "event",
    category: event.category,
    event,
    displayDate: dateKey,
    text: eventMonthText(event, t),
  }));
  return limitMonthItems([
    ...eventItems,
    ...statusGroupItemsForDate(dataset, dateKey, t),
    ...flowItemsForDate(dateKey, t),
  ], t);
}

function buildMonthDetailItems(dateKey, dataset, eventMap, t) {
  const eventItems = (eventMap.get(dateKey) || []).map((event) => ({
    type: "event",
    category: event.category,
    event,
    displayDate: dateKey,
    text: eventMonthText(event, t),
  }));
  return [...eventItems, ...statusItemsForDate(dataset, dateKey), ...flowItemsForDate(dateKey, t)];
}

function pressureSignal(value, mode = "change") {
  if (value?.carriedForward) return 0;
  if (!value) return 0;
  const raw = mode === "pct" && isMacroNumber(value.pctChange)
    ? value.pctChange
    : isMacroNumber(value.changeBp)
      ? value.changeBp
      : value.change;
  if (!isMacroNumber(raw) || Math.abs(Number(raw)) < 0.01) return 0;
  return Number(raw) > 0 ? 1 : -1;
}

function environmentDeltaText(item, t, mode = "change") {
  if (item?.carriedForward && item.observationEnd) return t.macroCalendar.asOf(dayLabel(item.observationEnd));
  if (mode === "pct" && isMacroNumber(item?.pctChange)) return formatPct(item.pctChange, 2);
  return formatMacroChange(item);
}

function macroUsdBillions(item) {
  if (!isMacroNumber(item?.end)) return null;
  if (item.unit === "usd_millions") return Number(item.end) / 1000;
  if (item.unit === "usd_billions" || item.unit === "usd_billions_chained") return Number(item.end);
  return null;
}

function formatMacroUsdLiquidity(value) {
  if (!isMacroNumber(value)) return "N/A";
  const billions = Number(value);
  if (Math.abs(billions) >= 1000) return `$${formatNumber(billions / 1000, 2)}T`;
  return `$${formatNumber(billions, 1)}B`;
}

function netLiquidityCard(values, t) {
  const fedAssets = macroUsdBillions(values.WALCL);
  const tga = macroUsdBillions(values.WTREGEN);
  const reverseRepo = macroUsdBillions(values.RRPONTSYD);
  const value = [fedAssets, tga, reverseRepo].every(isMacroNumber)
    ? fedAssets - tga - reverseRepo
    : null;
  return {
    label: t.htmlLang === "zh-CN" ? "\u51c0\u6d41\u52a8\u6027" : "Net liquidity",
    value: formatMacroUsdLiquidity(value),
    delta: "Fed-TGA-RRP",
    className: "",
  };
}

function environmentSummary(week, t) {
  const values = week?.values || {};
  const tenYear = values.DGS10;
  const realYield = values.DFII10;
  const dollar = values.DTWEXBGS;
  const vix = values.VIXCLS;
  const credit = values.BAMLH0A0HYM2;
  const tenYearRealLabel = t.htmlLang === "zh-CN" ? "10Y / \u5b9e\u9645\u5229\u7387" : "10Y / real yield";
  const score = pressureSignal(tenYear)
    + pressureSignal(dollar, "pct")
    + pressureSignal(vix)
    + pressureSignal(credit);
  const posture = score >= 2 ? t.macroCalendar.pressureHigh : score <= -2 ? t.macroCalendar.pressureLow : t.macroCalendar.pressureMedium;
  return {
    posture,
    score,
    cards: [
      { label: t.macroCalendar.riskPosture, value: posture, delta: week?.weekKey || "N/A", className: score >= 2 ? "macro-up" : score <= -2 ? "macro-down" : "" },
      { label: tenYearRealLabel, value: `${formatMacroValue(tenYear?.end, tenYear?.unit)} / ${formatMacroValue(realYield?.end, realYield?.unit)}`, delta: `${environmentDeltaText(tenYear, t)} / ${environmentDeltaText(realYield, t)}`, className: macroMoveClass((Number(tenYear?.changeBp) || 0) + (Number(realYield?.changeBp) || 0)) },
      { label: "DXY", value: formatMacroValue(dollar?.end, dollar?.unit), delta: environmentDeltaText(dollar, t, "pct"), className: dollar?.carriedForward ? "" : macroMoveClass(dollar?.pctChange) },
      { label: "VIX", value: formatMacroValue(vix?.end, vix?.unit), delta: environmentDeltaText(vix, t), className: macroMoveClass(vix?.change) },
      { label: "HY OAS", value: formatMacroValue(credit?.end, credit?.unit), delta: environmentDeltaText(credit, t), className: macroMoveClass(credit?.changeBp) },
      netLiquidityCard(values, t),
    ],
  };
}

function MacroEnvironmentPanel({ dataset, t }) {
  const currentWeek = findCurrentWeeklyState(dataset);
  const summary = environmentSummary(currentWeek, t);
  return (
    <section className="macro-environment" aria-label={t.macroCalendar.environmentTitle}>
      <div className="macro-section-heading">
        <div>
          <p>{t.macroCalendar.currentWeek}</p>
          <h2>{t.macroCalendar.environmentTitle}</h2>
        </div>
        <span>{currentWeek ? `${currentWeek.weekStart} - ${currentWeek.weekEnd}` : "N/A"}</span>
      </div>
      <div className="macro-environment-grid">
        {summary.cards.map((card) => (
          <div className="macro-environment-card" key={card.label}>
            <small>{card.label}</small>
            <strong className={card.className}>{card.value}</strong>
            <span className={card.className}>{card.delta}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MacroWeekCalendar({ dataset, language, t }) {
  const [visibleWeekDate, setVisibleWeekDate] = useState(() => localDateKeyForLanguage(language));
  const eventMap = useMemo(() => eventsByDate(dataset.events || [], language), [dataset, language]);
  const days = useMemo(() => weekDaysFor(visibleWeekDate, language), [visibleWeekDate, language]);
  const visibleWeek = useMemo(() => findWeeklyStateForDate(dataset, visibleWeekDate), [dataset, visibleWeekDate]);
  const statusItems = statusItemsForWeek(visibleWeek);
  const shiftVisibleWeek = (daysToAdd) => {
    setVisibleWeekDate((current) => dateKeyFromUtc(addUtcDays(utcDateFromKey(current), daysToAdd)));
  };
  return (
    <section className="visualization macro-calendar-section" aria-label={t.macroCalendar.weekCalendarTitle}>
      <div className="macro-section-heading">
        <div>
          <p>{t.macroCalendar.currentWeek}</p>
          <h2>{t.macroCalendar.weekCalendarTitle}</h2>
        </div>
        <span>{days[0].dateKey} - {days[6].dateKey}</span>
      </div>
      <div className="macro-week-carousel">
        <button type="button" className="macro-week-nav macro-week-prev" onClick={() => shiftVisibleWeek(-7)} aria-label={t.macroCalendar.previousWeek}>
          <span aria-hidden="true">&lt;</span>
        </button>
        <div className="table-shell macro-week-shell">
          <table className="macro-week-calendar">
            <caption className="sr-only">{t.macroCalendar.weekCalendarTitle}</caption>
            <thead>
              <tr>
                {days.map((day) => (
                  <th key={day.dateKey} className={day.isToday ? "is-today" : ""}>
                    <strong>{t.macroCalendar.weekdayNames[day.dayIndex]}</strong>
                    <span>{dayLabel(day.dateKey)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map((day) => {
                  const items = buildWeekDayItems(day.dateKey, eventMap, statusItems, t);
                  return (
                    <td
                      key={day.dateKey}
                      className={[
                        items.length ? "" : "macro-calendar-empty",
                        day.isToday ? "is-today" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {items.map((item) => (
                        <span className={`macro-mini-chip macro-${item.category}`} key={`${item.type}-${item.text}`}>
                          {item.text}
                        </span>
                      ))}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <button type="button" className="macro-week-nav macro-week-next" onClick={() => shiftVisibleWeek(7)} aria-label={t.macroCalendar.nextWeek}>
          <span aria-hidden="true">&gt;</span>
        </button>
      </div>
      <p className="macro-calendar-note">{t.macroCalendar.periodNotice}</p>
    </section>
  );
}

function MacroMonthCalendar({ dataset, selectedDate, setSelectedDate, visibleMonth, setVisibleMonth, language, t }) {
  const eventMap = useMemo(() => eventsByDate(dataset.events || [], language), [dataset, language]);
  const days = useMemo(() => monthGrid(visibleMonth, language), [visibleMonth, language]);
  const selectedItems = buildMonthDetailItems(selectedDate, dataset, eventMap, t);
  return (
    <section className="visualization macro-calendar-section" aria-label={t.macroCalendar.monthCalendarTitle}>
      <div className="macro-section-heading">
        <div>
          <p>{t.macroCalendar.clickDateHint}</p>
          <h2>{t.macroCalendar.monthCalendarTitle}</h2>
        </div>
        <div className="macro-month-controls">
          <button type="button" onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}>{t.macroCalendar.previousMonth}</button>
          <strong>{monthTitle(visibleMonth, language)}</strong>
          <button type="button" onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}>{t.macroCalendar.nextMonth}</button>
        </div>
      </div>
      <div className="macro-month-shell">
        <div className="macro-month-weekdays">
          {t.macroCalendar.weekdays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="macro-month-grid">
          {days.map((day) => {
            const items = buildMonthItems(day.dateKey, dataset, eventMap, t);
            const holidayCountries = holidayCountryCodesForDate(eventMap, day.dateKey);
            return (
              <button
                type="button"
                key={day.dateKey}
                className={[
                  "macro-month-day",
                  day.inMonth ? "" : "is-muted",
                  day.dateKey === selectedDate ? "is-selected" : "",
                  day.isToday ? "is-today" : "",
                  items.length ? "has-items" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => setSelectedDate(day.dateKey)}
              >
                <span className="macro-month-date-line">
                  <strong>{day.dayOfMonth}</strong>
                  {holidayCountries.length ? (
                    <span className="macro-country-markers">
                      {holidayCountries.map((countryCode) => (
                        <span className={`macro-country-marker country-${countryCode.toLowerCase()}`} title={holidayCountryLabel(countryCode, t)} key={countryCode}>
                          {countryCode}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span className="macro-month-items">
                  {items.length ? items.map((item) => (
                    <small className={`macro-month-tag macro-${item.category}`} title={item.label || item.text} key={`${item.type}-${item.text}`}>{item.text}</small>
                  )) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <MacroDateDetails dateKey={selectedDate} items={selectedItems} t={t} />
    </section>
  );
}

function holidayDisplayName(event, t) {
  if (t.htmlLang === "zh-CN" && event?.holidayNameZh) return event.holidayNameZh;
  return event?.holidayName || macroEventLabel(event, t);
}

function holidayDateNote(event, t) {
  const observedDate = event?.observedDate || event?.date;
  const legalDate = event?.legalDate || observedDate;
  if (!observedDate) return event?.note || "";
  if (legalDate && legalDate !== observedDate) {
    return t.macroCalendar.holidayObservedNote(observedDate, legalDate);
  }
  return t.macroCalendar.holidaySameDayNote(observedDate);
}

function MacroDateEventDetail({ item, t }) {
  const event = item.event;
  if (isHolidayEvent(event)) {
    const countryCode = holidayCountryCode(event);
    return (
      <div className="macro-date-detail-item macro-holiday-detail-item">
        <span className={`macro-pill macro-${item.category}`}>{macroCategoryLabel(item.category, t)}</span>
        <strong>{macroEventLabel(event, t)}</strong>
        <dl>
          <div><dt>{t.macroCalendar.holiday}</dt><dd>{holidayDisplayName(event, t)}</dd></div>
          <div><dt>{t.macroCalendar.observedDate}</dt><dd>{event.observedDate || event.date || "N/A"}</dd></div>
          <div><dt>{t.macroCalendar.legalDate}</dt><dd>{event.legalDate || event.observedDate || event.date || "N/A"}</dd></div>
          <div><dt>{t.macroCalendar.country}</dt><dd>{holidayCountryLabel(countryCode, t)}</dd></div>
        </dl>
        <small>{holidayDateNote(event, t)} / {event.source}</small>
      </div>
    );
  }
  return (
    <div className="macro-date-detail-item">
      <span className={`macro-pill macro-${item.category}`}>{macroCategoryLabel(item.category, t)}</span>
      <strong>{macroEventLabel(event, t)}</strong>
      <dl>
        <div><dt>{t.macroCalendar.previous}</dt><dd>{formatMacroValue(event.previous, event.unit)}</dd></div>
        <div><dt>{t.macroCalendar.actual}</dt><dd>{formatMacroValue(event.actual, event.unit)}</dd></div>
        <div><dt>{t.macroCalendar.change}</dt><dd className={macroMoveClass(event.change)}>{formatMacroChange(event)}</dd></div>
        <div><dt>{t.macroCalendar.yoy}</dt><dd className={macroMoveClass(event.yoyPct)}>{isMacroNumber(event.yoyPct) ? formatPct(event.yoyPct, 2) : "N/A"}</dd></div>
      </dl>
      <small>{macroDateMeaningLabel(event.dateMeaning, t)} / {event.source}</small>
    </div>
  );
}

function MacroDateDetails({ dateKey, items, t }) {
  return (
    <aside className="macro-date-detail" aria-live="polite">
      <div className="macro-date-detail-heading">
        <div>
          <small>{t.macroCalendar.selectedDate}</small>
          <strong>{dateKey}</strong>
        </div>
        <span>{items.length ? `${items.length} ${t.macroCalendar.eventCount}` : t.macroCalendar.noIndicators}</span>
      </div>
      {items.length ? (
        <div className="macro-date-detail-list">
          {items.map((item) => item.type === "event" ? (
            <MacroDateEventDetail item={item} t={t} key={`${item.event.seriesId}-${item.event.date}-${item.displayDate || dateKey}`} />
          ) : item.type === "status" ? (
            <div className="macro-date-detail-item" key={`${item.type}-${item.seriesId}-${item.date}`}>
              <span className={`macro-pill macro-${item.category}`}>{macroCategoryLabel(item.category, t)}</span>
              <strong>{item.value.label || item.label}</strong>
              <dl>
                <div><dt>{t.macroCalendar.previous}</dt><dd>{formatMacroValue(item.value.start, item.value.unit)}</dd></div>
                <div><dt>{t.macroCalendar.actual}</dt><dd>{formatMacroValue(item.value.end, item.value.unit)}</dd></div>
                <div><dt>{t.macroCalendar.change}</dt><dd className={macroMoveClass(item.value.changeBp ?? item.value.change)}>{formatMacroChange(item.value)}</dd></div>
                <div><dt>{t.macroCalendar.dateMeaning}</dt><dd>{item.value.observationStart === item.value.observationEnd ? dayLabel(item.value.observationEnd) : `${dayLabel(item.value.observationStart)}-${dayLabel(item.value.observationEnd)}`}</dd></div>
              </dl>
              <small>{macroDateMeaningLabel(item.value.dateMeaning, t)} / {item.value.source || item.seriesId}</small>
            </div>
          ) : (
            <div className="macro-date-detail-item" key={`${item.type}-${item.text}`}>
              <span className={`macro-pill macro-${item.category}`}>{macroCategoryLabel(item.category, t)}</span>
              <strong>{item.label}</strong>
              <small>{item.label === t.macroCalendar.earningsSeasonWindow ? t.macroCalendar.earningsSeasonNotice : t.macroCalendar.periodNotice}</small>
            </div>
          ))}
        </div>
      ) : (
        <p>{t.macroCalendar.noIndicators}</p>
      )}
    </aside>
  );
}

function MacroSummaryStrip({ dataset, t }) {
  return (
    <div className="latest-strip macro-summary-strip" aria-label={t.macroCalendar.window}>
      {(dataset.categorySummary || []).map((category) => (
        <div className="equity-summary-card macro-summary-card" key={category.category}>
          <span className="ticker">{macroCategoryLabel(category.category, t)}</span>
          <span className="latest-price">{category.eventCount} {t.macroCalendar.eventCount}</span>
          <span className="latest-return">{category.latestEventLabel ? compactIndicatorLabel(category.latestEventLabel, t) : t.macroCalendar.noLatest}</span>
          <small>{category.latestEventDate || category.latestStatus?.weekKey || t.macroCalendar.noLatest}</small>
        </div>
      ))}
    </div>
  );
}

function MacroEventsTable({ rows, selected, onSelect, t }) {
  return (
    <div className="table-shell macro-events-shell">
      <table className="data-table macro-events-table">
        <caption className="sr-only">{t.macroCalendar.eventsCaption}</caption>
        <thead>
          <tr>
            <th className="macro-date-column">{t.macroCalendar.date}</th>
            <th>{t.macroCalendar.category}</th>
            <th>{t.macroCalendar.indicator}</th>
            <th>{t.macroCalendar.actual}</th>
            <th>{t.macroCalendar.previous}</th>
            <th>{t.macroCalendar.forecast}</th>
            <th>{t.macroCalendar.change}</th>
            <th>{t.macroCalendar.yoy}</th>
            <th>{t.macroCalendar.source}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((event) => (
            <tr key={`${event.seriesId}-${event.date}-${event.label}`} className={selected === event ? "selected-row" : ""}>
              <th scope="row">
                <button type="button" onClick={() => onSelect(event)}>
                  <strong>{event.date}</strong>
                  <span>{macroDateMeaningLabel(event.dateMeaning, t)}</span>
                </button>
              </th>
              <td><span className={`macro-pill macro-${event.category}`}>{macroCategoryLabel(event.category, t)}</span></td>
              <td>
                <button type="button" className="macro-row-button" onClick={() => onSelect(event)}>
                  <strong>{macroEventLabel(event, t)}</strong>
                  <span>{event.seriesId}</span>
                </button>
              </td>
              <td>{formatMacroValue(event.actual, event.unit)}</td>
              <td>{formatMacroValue(event.previous, event.unit)}</td>
              <td>{formatMacroValue(event.forecast, event.unit)}</td>
              <td className={macroMoveClass(event.change)}>{formatMacroChange(event)}</td>
              <td className={macroMoveClass(event.yoyPct)}>{isMacroNumber(event.yoyPct) ? formatPct(event.yoyPct, 2) : "N/A"}</td>
              <td className="macro-source-cell">{event.source}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan="9" className="empty-table-cell">{t.macroCalendar.noRows}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="table-note">{t.macroCalendar.methodology}</div>
    </div>
  );
}

function MacroStateCell({ row, id, mode = "change", t }) {
  const item = row.values?.[id];
  if (!item) return <td className="return-na">N/A</td>;
  const moveValue = isMacroNumber(item.changeBp) ? item.changeBp : item.change;
  return (
    <td>
      <strong>{formatMacroValue(item.end, item.unit)}</strong>
      <span className={macroMoveClass(moveValue)}>
        {item.carriedForward && item.observationEnd
          ? t.macroCalendar.asOf(dayLabel(item.observationEnd))
          : mode === "pct" && isMacroNumber(item.pctChange)
            ? formatPct(item.pctChange, 2)
            : formatMacroChange(item)}
      </span>
    </td>
  );
}

function MacroStateTable({ rows, t }) {
  return (
    <div className="table-shell macro-state-shell">
      <table className="data-table macro-state-table">
        <caption className="sr-only">{t.macroCalendar.stateCaption}</caption>
        <thead>
          <tr>
            <th className="week-column">{t.macroCalendar.week}</th>
            <th>{t.macroCalendar.twoYear}</th>
            <th>{t.macroCalendar.tenYear}</th>
            <th>{t.macroCalendar.realYield}</th>
            <th>{t.macroCalendar.dollar}</th>
            <th>{t.macroCalendar.vix}</th>
            <th>{t.macroCalendar.credit}</th>
            <th>{t.macroCalendar.stress}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.weekKey}>
              <th scope="row">
                <strong>{row.weekKey}</strong>
                <span>{row.weekStart} - {row.weekEnd}</span>
              </th>
              <MacroStateCell row={row} id="DGS2" t={t} />
              <MacroStateCell row={row} id="DGS10" t={t} />
              <MacroStateCell row={row} id="DFII10" t={t} />
              <MacroStateCell row={row} id="DTWEXBGS" mode="pct" t={t} />
              <MacroStateCell row={row} id="VIXCLS" t={t} />
              <td>
                <strong>{formatMacroValue(row.values?.BAMLH0A0HYM2?.end, row.values?.BAMLH0A0HYM2?.unit)}</strong>
                <span className={macroMoveClass(row.values?.BAMLH0A0HYM2?.changeBp)}>{formatMacroChange(row.values?.BAMLH0A0HYM2)}</span>
              </td>
              <MacroStateCell row={row} id="STLFSI4" t={t} />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-note">{t.macroCalendar.stateCaption}</div>
    </div>
  );
}

function MacroDetailBand({ selected, t }) {
  if (!selected) {
    return (
      <aside className="detail-band detail-empty macro-detail-empty" aria-live="polite">
        <strong>{t.macroCalendar.emptyDetailTitle}</strong>
        <span>{t.macroCalendar.emptyDetailBody}</span>
      </aside>
    );
  }
  return (
    <aside className="detail-band macro-detail-band" aria-live="polite">
      <div>
        <small>{t.macroCalendar.selected}</small>
        <strong>{selected.label}</strong>
      </div>
      <div>
        <small>{t.macroCalendar.date}</small>
        <strong>{selected.date}</strong>
      </div>
      <div>
        <small>{t.macroCalendar.category}</small>
        <strong>{macroCategoryLabel(selected.category, t)}</strong>
      </div>
      <div>
        <small>{t.macroCalendar.actual}</small>
        <strong>{formatMacroValue(selected.actual, selected.unit)}</strong>
      </div>
      <div>
        <small>{t.macroCalendar.previous}</small>
        <strong>{formatMacroValue(selected.previous, selected.unit)}</strong>
      </div>
      <div>
        <small>{t.macroCalendar.change}</small>
        <strong className={macroMoveClass(selected.change)}>{formatMacroChange(selected)}</strong>
      </div>
      <div>
        <small>{t.macroCalendar.yoy}</small>
        <strong className={macroMoveClass(selected.yoyPct)}>{isMacroNumber(selected.yoyPct) ? formatPct(selected.yoyPct, 2) : "N/A"}</strong>
      </div>
      <div>
        <small>{t.macroCalendar.dateMeaning}</small>
        <strong>{macroDateMeaningLabel(selected.dateMeaning, t)}</strong>
      </div>
      <div className="ranking-line">
        <small>{t.macroCalendar.source}</small>
        <strong>{selected.source}</strong>
      </div>
    </aside>
  );
}

function MacroCalendarPage({ language, setLanguage, t }) {
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(appUrl("data/macro-calendar.json"), { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          const loadError = new Error("data-file");
          loadError.status = response.status;
          throw loadError;
        }
        return response.json();
      })
      .then((loadedDataset) => {
        setDataset(loadedDataset);
        setError(null);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError({ status: loadError.status, message: loadError.message });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    replaceHashState("macro-calendar", {});
  }, []);

  const defaultDate = useMemo(() => {
    if (!dataset) return null;
    return localDateKeyForLanguage(language);
  }, [dataset, language]);

  useEffect(() => {
    if (!dataset) return;
    setVisibleMonth((current) => current || monthKeyFromDateKey(defaultDate || dataset.window.endDate));
    setSelectedDate((current) => current || defaultDate || dataset.window.endDate);
  }, [dataset, defaultDate]);

  if (error) {
    return <main className="status-page"><h1>{t.macroCalendar.unavailable}</h1><p>{error.status ? `${t.status.dataFileFailed} (${error.status})` : error.message}</p></main>;
  }
  if (!dataset) {
    return <main className="status-page"><p>{t.macroCalendar.loading}</p></main>;
  }

  return (
    <main className="app-page macro-page">
      <header className="app-header">
        <div className="title-block">
          <p className="eyebrow">{t.macroCalendar.eyebrow}</p>
          <h1><span>{t.macroCalendar.titleAccent}</span> {t.macroCalendar.titleRest}</h1>
          <p>{t.macroCalendar.subtitle}</p>
          <PageNav page="macro" t={t} />
        </div>
        <div className="freshness-block">
          <LanguageToggle language={language} onChange={setLanguage} t={t} />
          <CacheStatus label={t.macroCalendar.cache} tooltip={t.macroCalendar.cacheTooltip} />
          <strong>{freshnessLabel(dataset.generatedAt, language)}</strong>
          <small>{dataset.failures?.length ? t.macroCalendar.failure(dataset.failures.length) : t.macroCalendar.success}</small>
        </div>
      </header>

      <MacroEnvironmentPanel dataset={dataset} t={t} />
      <MacroWeekCalendar dataset={dataset} language={language} t={t} />
      {visibleMonth && selectedDate ? (
        <MacroMonthCalendar
          dataset={dataset}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          visibleMonth={visibleMonth}
          setVisibleMonth={setVisibleMonth}
          language={language}
          t={t}
        />
      ) : null}

      <DataTrustFooter
        t={t}
        language={language}
        generatedAt={dataset.generatedAt}
        failures={dataset.failures}
        sources={[
          "FRED",
          "FRED release-date API",
          "ADP official static data",
          "Federal Reserve FOMC calendar",
          "OPM federal holidays",
          "Manual China holiday annotations",
        ]}
        methodology={language === "zh" ? t.macroCalendar.methodology : dataset.methodology || t.macroCalendar.methodology}
        limitations={t.macroCalendar.sourceNote}
      />
    </main>
  );
}

const EQUITY_ASSET_KEYS = ["QQQ", "SPY", "DIA"];
const NO_RIGHT_METRIC_ID = "__none__";
const USD_CNY_METRIC_ID = "macro.DEXCHUS.value";
const METRIC_CHART_DEFAULTS = {
  left: "equity.QQQ.close",
  right: "macro.VIXCLS.value",
  window: "1m",
  transform: "indexed",
  zoom: 1,
};
const METRIC_CHART_SIZE = { width: 960, height: 360, left: 76, right: 76, top: 24, bottom: 42 };
const METRIC_CHART_CATEGORY_ORDER = ["equity", "rates", "volatility", "inflation", "growth", "liquidity", "chip_chain", "robot_chain", "other"];

function metricChartCopyValue(value, language) {
  if (value && typeof value === "object") return language === "en" ? value.en : value.zh;
  return value || "";
}

function metricLabel(metric, language) {
  if (!metric) return "N/A";
  return language === "en" ? metric.labelEn || metric.labelZh || metric.id : metric.labelZh || metric.labelEn || metric.id;
}

function metricCategoryLabel(metric, language) {
  if (!metric) return "";
  return language === "en" ? metric.categoryLabelEn || metric.category : metric.categoryLabelZh || metric.category;
}

function metricOptionsByCategory(chartDataset, language) {
  const metrics = chartDataset?.metrics || {};
  const ids = chartDataset?.metricOrder || Object.keys(metrics);
  const grouped = new Map();
  ids.forEach((id) => {
    const metric = metrics[id];
    if (!metric) return;
    const category = metric.category || "other";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(metric);
  });
  return [...grouped.entries()]
    .sort((a, b) => {
      const ai = METRIC_CHART_CATEGORY_ORDER.indexOf(a[0]);
      const bi = METRIC_CHART_CATEGORY_ORDER.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map(([category, items]) => ({
      category,
      label: metricCategoryLabel(items[0], language),
      items: items.sort((a, b) => metricLabel(a, language).localeCompare(metricLabel(b, language))),
    }));
}

function metricWindowDays(chartDataset, windowValue) {
  return Number((chartDataset?.windows || []).find((item) => item.value === windowValue)?.days) || 31;
}

function metricSeriesPoints(chartDataset, metricId) {
  const source = chartDataset?.series?.[metricId] || [];
  return source
    .map((point) => ({ t: point.t, ms: Date.parse(point.t), raw: Number(point.v) }))
    .filter((point) => point.t && Number.isFinite(point.ms) && Number.isFinite(point.raw))
    .sort((a, b) => a.ms - b.ms);
}

function metricWindowEnd(chartDataset, metricIds) {
  const latestTimes = metricIds
    .flatMap((metricId) => metricSeriesPoints(chartDataset, metricId).map((point) => point.ms))
    .filter(Number.isFinite);
  return latestTimes.length ? Math.max(...latestTimes) : Date.now();
}

function metricWindowDomain(chartDataset, windowValue, windowEndMs) {
  const end = Number.isFinite(windowEndMs) ? windowEndMs : Date.now();
  return [end - metricWindowDays(chartDataset, windowValue) * 86400000, end];
}

function metricSeriesForWindow(chartDataset, metricId, windowValue, windowEndMs) {
  const points = metricSeriesPoints(chartDataset, metricId);
  if (!points.length) return [];
  const [start, end] = metricWindowDomain(chartDataset, windowValue, windowEndMs);
  return points.filter((point) => point.ms >= start && point.ms <= end);
}

function transformMetricPoints(points, transform) {
  if (!points.length) return [];
  if (transform === "indexed" || transform === "changePct") {
    const first = points.find((point) => Number.isFinite(point.raw) && point.raw !== 0)?.raw;
    if (!Number.isFinite(first) || first === 0) return points.map((point) => ({ ...point, value: point.raw }));
    return points.map((point) => ({
      ...point,
      value: transform === "indexed" ? (point.raw / first) * 100 : ((point.raw - first) / first) * 100,
    }));
  }
  if (transform === "zscore") {
    const values = points.map((point) => point.raw).filter(Number.isFinite);
    const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / Math.max(1, values.length);
    const stdev = Math.sqrt(variance) || 1;
    return points.map((point) => ({ ...point, value: (point.raw - mean) / stdev }));
  }
  return points.map((point) => ({ ...point, value: point.raw }));
}

function metricPercentile(values, percentile) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function metricAxisDomain(points, zoom) {
  const values = points.map((point) => point.value).filter(Number.isFinite);
  if (!values.length) return [0, 1];
  const actualMin = Math.min(...values);
  const actualMax = Math.max(...values);
  const low = metricPercentile(values, 0.05) ?? actualMin;
  const high = metricPercentile(values, 0.95) ?? actualMax;
  const spread = Math.max(Math.abs(high - low), Math.abs(actualMax - actualMin), Math.abs(high || actualMax) * 0.015, 1);
  const center = (low + high) / 2 - spread * 0.08;
  const half = (spread * 0.82) / Math.max(0.75, Number(zoom) || 1);
  return [center - half, center + half];
}

function metricChartY(value, domain, size = METRIC_CHART_SIZE) {
  const plotHeight = size.height - size.top - size.bottom;
  const ratio = (value - domain[0]) / Math.max(0.000001, domain[1] - domain[0]);
  return size.top + (1 - ratio) * plotHeight;
}

function metricChartX(ms, domain, size = METRIC_CHART_SIZE) {
  const plotWidth = size.width - size.left - size.right;
  const ratio = (ms - domain[0]) / Math.max(1, domain[1] - domain[0]);
  return size.left + ratio * plotWidth;
}

function plottedMetricPoints(points, xDomain, yDomain) {
  return points.map((point) => ({
    ...point,
    x: metricChartX(point.ms, xDomain),
    y: metricChartY(point.value, yDomain),
  }));
}

function metricGapLimitMs(metric) {
  const day = 86400000;
  if (metric?.cadence === "daily") return day * 4;
  if (metric?.cadence === "weekly") return day * 10;
  if (metric?.cadence === "monthly") return day * 38;
  if (metric?.cadence === "quarterly") return day * 105;
  return day * 10;
}

function metricLinePath(points, metric) {
  if (!points.length) return "";
  const gapLimit = metricGapLimitMs(metric);
  return points.map((point, index) => {
    const previous = points[index - 1];
    const command = !previous || point.ms - previous.ms > gapLimit ? "M" : "L";
    return `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}

function metricSparseDots(points) {
  if (points.length > 24) return [];
  return points;
}

function metricTicks(domain, count = 5) {
  return Array.from({ length: count }, (_, index) => domain[0] + ((domain[1] - domain[0]) * index) / (count - 1));
}

function metricXTicks(domain, windowValue) {
  const count = windowValue === "7d" ? 8 : 7;
  return metricTicks(domain, count);
}

function compactMetricAxisTitle(metric, language) {
  const label = metricLabel(metric, language);
  const maxLength = language === "en" ? 30 : 18;
  return label.length > maxLength ? `${label.slice(0, maxLength - 3)}...` : label;
}

function nearestMetricPoint(points, targetMs) {
  if (!points.length) return null;
  return points.reduce((nearest, point) => {
    if (!nearest) return point;
    return Math.abs(point.ms - targetMs) < Math.abs(nearest.ms - targetMs) ? point : nearest;
  }, null);
}

function metricDateLabel(value, language, compact = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  const locale = language === "en" ? "en-US" : "zh-CN";
  const options = compact
    ? { month: "2-digit", day: "2-digit" }
    : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  return new Intl.DateTimeFormat(locale, { timeZone: language === "en" ? "America/New_York" : "Asia/Shanghai", ...options }).format(date);
}

function formatMetricChartValue(value, metric, transform, language) {
  if (!Number.isFinite(Number(value))) return "N/A";
  const number = Number(value);
  if (transform === "indexed") return formatNumber(number, 1);
  if (transform === "changePct") return `${formatNumber(number, 2)}%`;
  if (transform === "zscore") return `${formatNumber(number, 2)} sd`;
  const unit = metric?.unit;
  if (unit === "percent") return `${formatNumber(number, 2)}%`;
  if (unit === "fx") return formatNumber(number, 4);
  if (unit === "USD" || unit === "USDT" || unit === "usd") return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(number);
  if (unit === "persons" || unit === "thousand_persons" || unit === "shares") return new Intl.NumberFormat(language === "en" ? "en-US" : "zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(number);
  if (unit === "usd_millions") return `$${formatNumber(number / 1000, 1)}B`;
  if (unit === "usd_billions" || unit === "usd_billions_chained") return `$${formatNumber(number, 1)}B`;
  return formatNumber(number, Math.abs(number) >= 100 ? 1 : 2);
}

function MetricSelect({ label, value, onChange, groups, language, emptyOptionLabel = null, emptyOptionValue = "" }) {
  return (
    <label className="metric-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {emptyOptionLabel ? <option value={emptyOptionValue}>{emptyOptionLabel}</option> : null}
        {groups.map((group) => (
          <optgroup label={group.label} key={group.category}>
            {group.items.map((metric) => (
              <option value={metric.id} key={metric.id}>{metricLabel(metric, language)}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function equityAssetLabel(dataset, symbol, t) {
  if (symbol === "DIA") return equityCopy(t).dow;
  return dataset.assets?.[symbol]?.displaySymbol || symbol;
}

function equityDaysByDate(dataset) {
  return new Map((dataset?.days || []).map((day) => [day.date, day]));
}

function latestEquityDate(dataset) {
  return dataset?.latest?.date || [...(dataset?.days || [])].reverse().find((day) => day.isMarketDay && Object.values(day.assets || {}).some(Boolean))?.date || dataset?.window?.endDate;
}

function formatEquityPrice(value) {
  if (!Number.isFinite(Number(value))) return "N/A";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(value));
}

function formatEquityMacroValue(value, unit) {
  if (!Number.isFinite(Number(value))) return "N/A";
  if (unit === "percent") return `${formatNumber(value, 2)}%`;
  return formatNumber(value, 2);
}

function formatEquityMacroChange(seriesId, value) {
  if (!value) return "N/A";
  if (seriesId === "DGS10") return formatBp(value.changeBp, 0);
  return formatSignedNumber(value.change, 2);
}

function metricPointAtOrBeforeDate(chartDataset, metricId, dateKey, maxLagDays = 10) {
  if (!chartDataset || !dateKey) return null;
  const metric = chartDataset.metrics?.[metricId];
  if (!metric) return null;
  const targetMs = Date.parse(`${dateKey}T23:59:59Z`);
  if (!Number.isFinite(targetMs)) return null;
  let previous = null;
  let selected = null;
  for (const point of metricSeriesPoints(chartDataset, metricId)) {
    if (point.ms > targetMs) break;
    previous = selected;
    selected = point;
  }
  if (!selected || targetMs - selected.ms > maxLagDays * 86400000) return null;
  return {
    metric,
    point: selected,
    previous,
    change: previous ? selected.raw - previous.raw : null,
  };
}

function equityMoveClass(value) {
  if (!Number.isFinite(Number(value)) || Number(value) === 0) return "";
  return Number(value) > 0 ? "positive" : "negative";
}

function equityMarketPrice(asset) {
  return Number.isFinite(Number(asset?.price)) ? Number(asset.price) : Number(asset?.close);
}

function equityOpenMove(asset) {
  const current = equityMarketPrice(asset);
  const open = Number(asset?.open);
  if (!Number.isFinite(current) || !Number.isFinite(open)) return null;
  return current - open;
}

function equityDirectionSymbol(asset) {
  const move = equityOpenMove(asset);
  if (!Number.isFinite(Number(move)) || Math.abs(Number(move)) < 0.0001) return "\u2192";
  return Number(move) > 0 ? "\u2191" : "\u2193";
}

function equityDirectionClass(asset) {
  return equityMoveClass(equityOpenMove(asset));
}

function equityFastMetric(dataset, metricId) {
  return (dataset.fast?.metrics || []).find((metric) => metric.id === metricId) || null;
}

function formatUsdCompact(value) {
  if (value == null || value === "") return "N/A";
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  const abs = Math.abs(number);
  if (abs >= 1_000_000_000_000) return `$${formatNumber(number / 1_000_000_000_000, 2)}T`;
  if (abs >= 1_000_000_000) return `$${formatNumber(number / 1_000_000_000, 1)}B`;
  if (abs >= 1_000_000) return `$${formatNumber(number / 1_000_000, 1)}M`;
  return `$${formatNumber(number, 0)}`;
}

function formatEquityFastMetricValue(metric) {
  if (!metric) return "N/A";
  const number = Number(metric.value);
  if (metric.value == null || metric.value === "" || !Number.isFinite(number)) return "N/A";
  if (metric.unit === "USD") return formatUsdCompact(metric.value);
  if (metric.unit === "index") return formatNumber(metric.value, 2);
  return formatEquityPrice(metric.value);
}

function formatEquityFastMetricNote(metric, copy, language) {
  if (!metric?.asOf) return copy.waitingForFastData;
  if (/^\d{4}-\d{2}-\d{2}$/.test(metric.asOf)) return dayLabel(metric.asOf);
  const timestamp = new Date(metric.asOf);
  if (Number.isNaN(timestamp.getTime())) return metric.asOf;
  const locale = language === "en" ? "en-US" : "zh-CN";
  const timeZone = language === "en" ? "America/New_York" : "Asia/Shanghai";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function EquityMarketSummary({ dataset, t }) {
  const copy = equityCopy(t);
  const language = t.htmlLang === "zh-CN" ? "zh" : "en";
  const latest = dataset.latest || {};
  const cards = EQUITY_ASSET_KEYS.map((symbol) => {
    const item = latest.assets?.[symbol];
    return {
      key: symbol,
      label: equityAssetLabel(dataset, symbol, t),
      value: formatEquityPrice(item?.price ?? item?.close),
      delta: formatPct(item?.pct, 2),
      className: equityMoveClass(item?.pct),
      note: item?.date || latest.date || "N/A",
    };
  });
  const fastCards = [
    ["BTC_MARKET_CAP", copy.btcMarketCap],
    ["CRYPTO_MARKET_CAP", copy.cryptoMarketCap],
    ["GOLD_PRICE_PROXY", copy.goldProxy],
  ].map(([metricId, label]) => {
    const metric = equityFastMetric(dataset, metricId);
    return {
      key: metricId,
      label,
      value: formatEquityFastMetricValue(metric),
      delta: Number.isFinite(Number(metric?.changePct)) ? formatPct(metric.changePct, 2) : "N/A",
      className: equityMoveClass(metric?.changePct),
      note: formatEquityFastMetricNote(metric, copy, language),
    };
  });
  const tenYear = latest.macro?.DGS10;
  const vix = latest.macro?.VIXCLS;
  return (
    <div className="latest-strip equity-strip" aria-label={copy.latest}>
      {cards.map((card) => (
        <div className="equity-summary-card" key={card.key}>
          <span className="ticker">{card.label}</span>
          <span className="latest-price">{card.value}</span>
          <span className={`latest-return ${card.className}`}>{card.delta}</span>
          <small>{card.note}</small>
        </div>
      ))}
      <div className="equity-summary-card equity-macro-summary">
        <span className="ticker">{copy.macro}</span>
        <div className="equity-summary-lines">
          <span><b>{copy.tenYear}</b><strong>{formatEquityMacroValue(tenYear?.value, "percent")}</strong><em className={macroClass(tenYear?.changeBp)}>{formatEquityMacroChange("DGS10", tenYear)}</em></span>
          <span><b>{copy.vix}</b><strong>{formatEquityMacroValue(vix?.value, "index")}</strong><em className={macroClass(vix?.change)}>{formatEquityMacroChange("VIXCLS", vix)}</em></span>
        </div>
        <small>{latest.date || "N/A"}</small>
      </div>
      {fastCards.map((card) => (
        <div className="equity-summary-card equity-fast-summary" key={card.key}>
          <span className="ticker">{card.label}</span>
          <span className="latest-price">{card.value}</span>
          <span className={`latest-return ${card.className}`}>{card.delta}</span>
          <small>{card.note}</small>
        </div>
      ))}
    </div>
  );
}

function MetricComparePanel({ chartDataset, language, t }) {
  const copy = equityCopy(t);
  const metrics = chartDataset?.metrics || {};
  const metricIds = chartDataset?.metricOrder || Object.keys(metrics);
  const defaultLeft = metrics[METRIC_CHART_DEFAULTS.left] ? METRIC_CHART_DEFAULTS.left : metricIds[0];
  const defaultRight = metrics[METRIC_CHART_DEFAULTS.right] ? METRIC_CHART_DEFAULTS.right : NO_RIGHT_METRIC_ID;
  const [leftMetricId, setLeftMetricId] = useState(defaultLeft || "");
  const [rightMetricId, setRightMetricId] = useState(defaultRight || "");
  const [windowValue, setWindowValue] = useState(METRIC_CHART_DEFAULTS.window);
  const [transform, setTransform] = useState(METRIC_CHART_DEFAULTS.transform);
  const [zoom, setZoom] = useState(METRIC_CHART_DEFAULTS.zoom);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!metricIds.length) return;
    setLeftMetricId((current) => metrics[current] ? current : defaultLeft || metricIds[0]);
    setRightMetricId((current) => current === NO_RIGHT_METRIC_ID || metrics[current] ? current : defaultRight || NO_RIGHT_METRIC_ID);
  }, [defaultLeft, defaultRight, metricIds, metrics]);

  const groups = useMemo(() => metricOptionsByCategory(chartDataset, language), [chartDataset, language]);
  const windows = chartDataset?.windows?.length ? chartDataset.windows : [
    { value: "1d", label: "1D" },
    { value: "7d", label: "7D" },
    { value: "1m", label: "1M" },
    { value: "3m", label: "3M" },
  ];
  const transforms = chartDataset?.transforms?.length ? chartDataset.transforms : [];
  const leftMetric = metrics[leftMetricId];
  const rightMetric = metrics[rightMetricId];
  const hasRightMetric = rightMetricId !== NO_RIGHT_METRIC_ID && Boolean(rightMetric);
  const selectedMetricIds = useMemo(() => [leftMetricId, hasRightMetric ? rightMetricId : null].filter(Boolean), [leftMetricId, rightMetricId, hasRightMetric]);
  const windowEndMs = useMemo(() => metricWindowEnd(chartDataset, selectedMetricIds), [chartDataset, selectedMetricIds]);
  const xDomain = useMemo(() => metricWindowDomain(chartDataset, windowValue, windowEndMs), [chartDataset, windowValue, windowEndMs]);
  const leftRaw = useMemo(() => metricSeriesForWindow(chartDataset, leftMetricId, windowValue, windowEndMs), [chartDataset, leftMetricId, windowValue, windowEndMs]);
  const rightRaw = useMemo(() => hasRightMetric ? metricSeriesForWindow(chartDataset, rightMetricId, windowValue, windowEndMs) : [], [chartDataset, rightMetricId, windowValue, windowEndMs, hasRightMetric]);
  const leftSeries = useMemo(() => transformMetricPoints(leftRaw, transform), [leftRaw, transform]);
  const rightSeries = useMemo(() => transformMetricPoints(rightRaw, transform), [rightRaw, transform]);
  const leftDomain = useMemo(() => metricAxisDomain(leftSeries, zoom), [leftSeries, zoom]);
  const rightDomain = useMemo(() => metricAxisDomain(rightSeries, zoom), [rightSeries, zoom]);
  const leftPoints = useMemo(() => plottedMetricPoints(leftSeries, xDomain, leftDomain), [leftSeries, xDomain, leftDomain]);
  const rightPoints = useMemo(() => plottedMetricPoints(rightSeries, xDomain, rightDomain), [rightSeries, xDomain, rightDomain]);
  const leftPath = useMemo(() => metricLinePath(leftPoints, leftMetric), [leftPoints, leftMetric]);
  const rightPath = useMemo(() => metricLinePath(rightPoints, rightMetric), [rightPoints, rightMetric]);
  const leftDots = useMemo(() => metricSparseDots(leftPoints), [leftPoints]);
  const rightDots = useMemo(() => metricSparseDots(rightPoints), [rightPoints]);
  const xTicks = useMemo(() => metricXTicks(xDomain, windowValue), [xDomain, windowValue]);
  const leftTicks = useMemo(() => metricTicks(leftDomain, 5), [leftDomain]);
  const rightTicks = useMemo(() => metricTicks(rightDomain, 5), [rightDomain]);
  const hasDrawableLine = leftPoints.length >= 2 || rightPoints.length >= 2;

  if (!chartDataset) {
    return (
      <section className="visualization metric-compare-section">
        <div className="macro-section-heading">
          <div>
            <p>{copy.compareKicker}</p>
            <h2>{copy.compareTitle}</h2>
          </div>
        </div>
        <div className="metric-chart-empty">{copy.chartLoading}</div>
      </section>
    );
  }

  if (!metricIds.length) {
    return (
      <section className="visualization metric-compare-section">
        <div className="macro-section-heading">
          <div>
            <p>{copy.compareKicker}</p>
            <h2>{copy.compareTitle}</h2>
          </div>
        </div>
        <div className="metric-chart-empty">{copy.chartUnavailable}</div>
      </section>
    );
  }

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * METRIC_CHART_SIZE.width;
    const clampedX = Math.max(METRIC_CHART_SIZE.left, Math.min(METRIC_CHART_SIZE.width - METRIC_CHART_SIZE.right, svgX));
    const targetMs = xDomain[0] + ((clampedX - METRIC_CHART_SIZE.left) / (METRIC_CHART_SIZE.width - METRIC_CHART_SIZE.left - METRIC_CHART_SIZE.right)) * (xDomain[1] - xDomain[0]);
    setHover({
      x: clampedX,
      left: nearestMetricPoint(leftPoints, targetMs),
      right: hasRightMetric ? nearestMetricPoint(rightPoints, targetMs) : null,
    });
  };

  const resetChart = () => {
    setLeftMetricId(defaultLeft || metricIds[0]);
    setRightMetricId(defaultRight || NO_RIGHT_METRIC_ID);
    setWindowValue(METRIC_CHART_DEFAULTS.window);
    setTransform(METRIC_CHART_DEFAULTS.transform);
    setZoom(METRIC_CHART_DEFAULTS.zoom);
    setHover(null);
  };

  const leftLatest = leftRaw.at(-1);
  const rightLatest = rightRaw.at(-1);

  return (
    <section className="visualization metric-compare-section" aria-label={copy.compareTitle}>
      <div className="macro-section-heading metric-compare-heading">
        <div>
          <p>{copy.compareKicker}</p>
          <h2>{copy.compareTitle}</h2>
        </div>
        <span>{copy.compareSubtitle}</span>
      </div>

      <div className="metric-chart-controls" aria-label={copy.compareTitle}>
        <MetricSelect label={copy.leftAxis} value={leftMetricId} onChange={setLeftMetricId} groups={groups} language={language} />
        <MetricSelect
          label={copy.rightAxis}
          value={rightMetricId}
          onChange={setRightMetricId}
          groups={groups}
          language={language}
          emptyOptionLabel={copy.noRightAxis}
          emptyOptionValue={NO_RIGHT_METRIC_ID}
        />
        <div className="metric-control-group">
          <span>{copy.xWindow}</span>
          <div className="segmented segmented-compact">
            {windows.map((item) => (
              <button type="button" className={windowValue === item.value ? "is-active" : ""} onClick={() => setWindowValue(item.value)} key={item.value}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="metric-control-group">
          <span>{copy.transform}</span>
          <div className="segmented segmented-compact">
            {transforms.map((item) => (
              <button type="button" className={transform === item.value ? "is-active" : ""} onClick={() => setTransform(item.value)} key={item.value}>
                {language === "en" ? item.labelEn : item.labelZh}
              </button>
            ))}
          </div>
        </div>
        <label className="metric-zoom-control">
          <span>{copy.yZoom} {formatNumber(zoom, 2)}x</span>
          <input type="range" min="0.75" max="2.5" step="0.25" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        </label>
        <button type="button" className="metric-reset-button" onClick={resetChart}>{copy.reset}</button>
      </div>

      <div className="metric-chart-frame">
        <svg
          className="metric-chart-svg"
          viewBox={`0 0 ${METRIC_CHART_SIZE.width} ${METRIC_CHART_SIZE.height}`}
          role="img"
          aria-label={`${metricLabel(leftMetric, language)}${hasRightMetric ? ` / ${metricLabel(rightMetric, language)}` : ""}`}
          onMouseMove={handlePointerMove}
          onMouseLeave={() => setHover(null)}
          focusable="false"
        >
          <rect
            className="metric-chart-bg"
            x={METRIC_CHART_SIZE.left}
            y={METRIC_CHART_SIZE.top}
            width={METRIC_CHART_SIZE.width - METRIC_CHART_SIZE.left - METRIC_CHART_SIZE.right}
            height={METRIC_CHART_SIZE.height - METRIC_CHART_SIZE.top - METRIC_CHART_SIZE.bottom}
          />
          {leftTicks.map((tick) => {
            const y = metricChartY(tick, leftDomain);
            return (
              <Fragment key={`left-${tick}`}>
                <line className="metric-chart-grid" x1={METRIC_CHART_SIZE.left} x2={METRIC_CHART_SIZE.width - METRIC_CHART_SIZE.right} y1={y} y2={y} />
                <text className="metric-axis-label metric-axis-left" x={METRIC_CHART_SIZE.left - 10} y={y + 4}>{formatMetricChartValue(tick, leftMetric, transform, language)}</text>
              </Fragment>
            );
          })}
          {hasRightMetric ? rightTicks.map((tick) => {
            const y = metricChartY(tick, rightDomain);
            return (
              <text className="metric-axis-label metric-axis-right" x={METRIC_CHART_SIZE.width - METRIC_CHART_SIZE.right + 10} y={y + 4} key={`right-${tick}`}>
                {formatMetricChartValue(tick, rightMetric, transform, language)}
              </text>
            );
          }) : null}
          <text className="metric-axis-title metric-axis-title-left" x={METRIC_CHART_SIZE.left} y={METRIC_CHART_SIZE.top - 8}>
            {copy.leftAxis}: {compactMetricAxisTitle(leftMetric, language)}
          </text>
          {hasRightMetric ? (
            <text className="metric-axis-title metric-axis-title-right" x={METRIC_CHART_SIZE.width - METRIC_CHART_SIZE.right} y={METRIC_CHART_SIZE.top - 8}>
              {copy.rightAxis}: {compactMetricAxisTitle(rightMetric, language)}
            </text>
          ) : null}
          {xTicks.map((tick) => {
            const x = metricChartX(tick, xDomain);
            return (
              <Fragment key={`x-${tick}`}>
                <line className="metric-chart-grid metric-chart-grid-vertical" x1={x} x2={x} y1={METRIC_CHART_SIZE.top} y2={METRIC_CHART_SIZE.height - METRIC_CHART_SIZE.bottom} />
                <text className="metric-axis-label metric-axis-bottom" x={x} y={METRIC_CHART_SIZE.height - 14}>{metricDateLabel(tick, language, xDomain[1] - xDomain[0] > 172800000)}</text>
              </Fragment>
            );
          })}
          {hover ? <line className="metric-hover-line" x1={hover.x} x2={hover.x} y1={METRIC_CHART_SIZE.top} y2={METRIC_CHART_SIZE.height - METRIC_CHART_SIZE.bottom} /> : null}
          {leftPoints.length >= 2 ? <path className="metric-line metric-line-left" d={leftPath} /> : null}
          {hasRightMetric && rightPoints.length >= 2 ? <path className="metric-line metric-line-right" d={rightPath} /> : null}
          {leftDots.map((point) => (
            <circle className="metric-sample-dot metric-sample-left" cx={point.x} cy={point.y} r="2.6" key={`left-dot-${point.t}`} />
          ))}
          {hasRightMetric ? rightDots.map((point) => (
            <circle className="metric-sample-dot metric-sample-right" cx={point.x} cy={point.y} r="2.6" key={`right-dot-${point.t}`} />
          )) : null}
          {leftPoints.length ? <circle className="metric-end-dot metric-end-left" cx={leftPoints.at(-1).x} cy={leftPoints.at(-1).y} r="4" /> : null}
          {hasRightMetric && rightPoints.length ? <circle className="metric-end-dot metric-end-right" cx={rightPoints.at(-1).x} cy={rightPoints.at(-1).y} r="4" /> : null}
        </svg>
        {hover ? (
          <div className="metric-tooltip" style={{ left: `${(hover.x / METRIC_CHART_SIZE.width) * 100}%` }}>
            {hover.left ? (
              <span>
                <b className="metric-left-swatch">{metricLabel(leftMetric, language)}</b>
                <strong>{formatMetricChartValue(hover.left.value, leftMetric, transform, language)}</strong>
                <em>{formatMetricChartValue(hover.left.raw, leftMetric, "raw", language)} / {metricDateLabel(hover.left.ms, language)}</em>
              </span>
            ) : null}
            {hover.right ? (
              <span>
                <b className="metric-right-swatch">{metricLabel(rightMetric, language)}</b>
                <strong>{formatMetricChartValue(hover.right.value, rightMetric, transform, language)}</strong>
                <em>{formatMetricChartValue(hover.right.raw, rightMetric, "raw", language)} / {metricDateLabel(hover.right.ms, language)}</em>
              </span>
            ) : null}
          </div>
        ) : null}
        {!hasDrawableLine ? <div className="metric-chart-empty is-overlay">{copy.chartInsufficient}</div> : null}
      </div>

      <div className="metric-chart-meta">
        <div>
          <span className="metric-left-swatch">{copy.leftAxis}</span>
          <strong>{metricLabel(leftMetric, language)}</strong>
          <small>{leftSeries.length} {copy.points} / {copy.latestPoint} {leftLatest ? formatMetricChartValue(leftLatest.raw, leftMetric, "raw", language) : "N/A"}</small>
          <em>{copy.source}: {leftMetric?.source || "N/A"}</em>
        </div>
        {hasRightMetric ? (
          <div>
            <span className="metric-right-swatch">{copy.rightAxis}</span>
            <strong>{metricLabel(rightMetric, language)}</strong>
            <small>{rightSeries.length} {copy.points} / {copy.latestPoint} {rightLatest ? formatMetricChartValue(rightLatest.raw, rightMetric, "raw", language) : "N/A"}</small>
            <em>{copy.source}: {rightMetric?.source || "N/A"}</em>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EquityMarketWeekCalendar({ dataset, visibleWeekDate, setVisibleWeekDate, t }) {
  const copy = equityCopy(t);
  const byDate = useMemo(() => equityDaysByDate(dataset), [dataset]);
  const days = useMemo(() => weekDaysFor(visibleWeekDate), [visibleWeekDate]);
  const shiftVisibleWeek = (daysToAdd) => {
    setVisibleWeekDate((current) => dateKeyFromUtc(addUtcDays(utcDateFromKey(current), daysToAdd)));
  };
  return (
    <section className="visualization equity-calendar-section" aria-label={copy.weekCalendarTitle}>
      <div className="macro-section-heading">
        <div>
          <p>{copy.currentWeek}</p>
          <h2>{copy.weekCalendarTitle}</h2>
        </div>
        <span>{days[0].dateKey} - {days[6].dateKey}</span>
      </div>
      <div className="macro-week-carousel">
        <button type="button" className="macro-week-nav macro-week-prev" onClick={() => shiftVisibleWeek(-7)} aria-label={copy.previousWeek}>
          <span aria-hidden="true">&lt;</span>
        </button>
        <div className="table-shell macro-week-shell">
          <table className="macro-week-calendar equity-week-calendar">
            <caption className="sr-only">{copy.weekCalendarTitle}</caption>
            <thead>
              <tr>
                {days.map((day) => (
                  <th key={day.dateKey} className={day.isToday ? "is-today" : ""}>
                    <strong>{t.macroCalendar.weekdayNames[day.dayIndex]}</strong>
                    <span>{dayLabel(day.dateKey)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map((day) => {
                  const row = byDate.get(day.dateKey);
                  const hasData = row?.isMarketDay && Object.values(row.assets || {}).some(Boolean);
                  const isClosed = (row && !row.isMarketDay) || (!row && (day.dayIndex === 0 || day.dayIndex === 6));
                  return (
                    <td key={day.dateKey} className={[hasData ? "" : "macro-calendar-empty", isClosed ? "is-closed" : "", day.isToday ? "is-today" : ""].filter(Boolean).join(" ")}>
                      {hasData ? (
                        <div className="equity-day-detail">
                          {EQUITY_ASSET_KEYS.map((symbol) => {
                            const asset = row.assets?.[symbol];
                            return asset ? (
                              <span className={`equity-day-row equity-direction-row ${equityDirectionClass(asset)}`} key={symbol}>
                                <b>{equityAssetLabel(dataset, symbol, t)}</b>
                                <strong>{equityDirectionSymbol(asset)}</strong>
                              </span>
                            ) : null;
                          })}
                          {["DGS10", "VIXCLS"].map((seriesId) => {
                            const item = row.macro?.[seriesId];
                            const label = seriesId === "DGS10" ? copy.tenYear : copy.vix;
                            return item ? (
                              <span className="equity-day-row equity-macro-row" key={seriesId}>
                                <b>{label}</b>
                                <em>{formatEquityMacroValue(item.value, dataset.macroSeries?.[seriesId]?.unit)}</em>
                                <strong className={macroClass(seriesId === "DGS10" ? item.changeBp : item.change)}>{formatEquityMacroChange(seriesId, item)}</strong>
                              </span>
                            ) : null;
                          })}
                        </div>
                      ) : isClosed ? (
                        <div className="equity-day-detail">
                          <span className="equity-market-closed">{copy.marketClosed}</span>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <button type="button" className="macro-week-nav macro-week-next" onClick={() => shiftVisibleWeek(7)} aria-label={copy.nextWeek}>
          <span aria-hidden="true">&gt;</span>
        </button>
      </div>
    </section>
  );
}

function EquityDateDetails({ dateKey, row, dataset, t }) {
  const copy = equityCopy(t);
  const language = t.htmlLang === "zh-CN" ? "zh" : "en";
  const assetItems = EQUITY_ASSET_KEYS
    .map((symbol) => ({ symbol, asset: row?.assets?.[symbol] }))
    .filter((item) => item.asset);
  const macroItems = ["DGS10", "VIXCLS"]
    .map((seriesId) => ({ seriesId, item: row?.macro?.[seriesId] }))
    .filter((entry) => entry.item);
  const usdCnyItem = metricPointAtOrBeforeDate(dataset.chartSeries, USD_CNY_METRIC_ID, dateKey);
  const count = assetItems.length + macroItems.length + (usdCnyItem ? 1 : 0);
  const isClosed = row && !row.isMarketDay;
  return (
    <aside className="macro-date-detail equity-date-detail" aria-live="polite">
      <div className="macro-date-detail-heading">
        <div>
          <small>{t.macroCalendar.selectedDate}</small>
          <strong>{dateKey}</strong>
        </div>
        <span>{count ? `${count} ${copy.priceIndicators}` : isClosed ? copy.marketClosed : t.macroCalendar.noIndicators}</span>
      </div>
      {count ? (
        <div className="macro-date-detail-list">
          {assetItems.map(({ symbol, asset }) => {
            const current = equityMarketPrice(asset);
            const move = equityOpenMove(asset);
            const className = equityMoveClass(move);
            return (
              <div className="macro-date-detail-item equity-date-detail-item" key={`${symbol}-${asset.date || dateKey}`}>
                <span className={`macro-pill equity-pill ${className}`}>{equityAssetLabel(dataset, symbol, t)}</span>
                <strong>{dataset.assets?.[symbol]?.name || symbol}</strong>
                <dl>
                  <div><dt>{copy.open}</dt><dd>{formatEquityPrice(asset.open)}</dd></div>
                  <div><dt>{copy.currentPrice}</dt><dd>{formatEquityPrice(current)}</dd></div>
                  <div><dt>{copy.dayMove}</dt><dd className={className}>{formatPct(asset.pct, 2)}</dd></div>
                  <div><dt>{copy.close}</dt><dd>{formatEquityPrice(asset.close)}</dd></div>
                </dl>
                <small>{asset.date || dateKey} / {dataset.assets?.[symbol]?.sourceLabel || symbol}</small>
              </div>
            );
          })}
          {macroItems.map(({ seriesId, item }) => {
            const label = seriesId === "DGS10" ? copy.tenYear : copy.vix;
            const unit = dataset.macroSeries?.[seriesId]?.unit;
            const move = seriesId === "DGS10" ? item.changeBp : item.change;
            return (
              <div className="macro-date-detail-item equity-date-detail-item" key={`${seriesId}-${item.date || dateKey}`}>
                <span className={`macro-pill ${seriesId === "DGS10" ? "macro-rates" : "macro-volatility"}`}>{label}</span>
                <strong>{dataset.macroSeries?.[seriesId]?.label || label}</strong>
                <dl>
                  <div><dt>{t.macroCalendar.previous}</dt><dd>{formatEquityMacroValue(item.previous, unit)}</dd></div>
                  <div><dt>{t.macroCalendar.actual}</dt><dd>{formatEquityMacroValue(item.value, unit)}</dd></div>
                  <div><dt>{t.macroCalendar.change}</dt><dd className={macroClass(move)}>{formatEquityMacroChange(seriesId, item)}</dd></div>
                  <div><dt>{t.macroCalendar.dateMeaning}</dt><dd>{dayLabel(item.date || dateKey)}</dd></div>
                </dl>
                <small>{t.macroCalendar.dailyObservation} / FRED</small>
              </div>
            );
          })}
          {usdCnyItem ? (
            <div className="macro-date-detail-item equity-date-detail-item" key={`${USD_CNY_METRIC_ID}-${usdCnyItem.point.t}`}>
              <span className="macro-pill macro-rates">{copy.usdCny}</span>
              <strong>{metricLabel(usdCnyItem.metric, language)}</strong>
              <dl>
                <div><dt>{t.macroCalendar.previous}</dt><dd>{usdCnyItem.previous ? formatMetricChartValue(usdCnyItem.previous.raw, usdCnyItem.metric, "raw", language) : "N/A"}</dd></div>
                <div><dt>{t.macroCalendar.actual}</dt><dd>{formatMetricChartValue(usdCnyItem.point.raw, usdCnyItem.metric, "raw", language)}</dd></div>
                <div><dt>{t.macroCalendar.change}</dt><dd className={macroClass(usdCnyItem.change)}>{Number.isFinite(Number(usdCnyItem.change)) ? formatSignedNumber(usdCnyItem.change, 4) : "N/A"}</dd></div>
                <div><dt>{t.macroCalendar.observedDate}</dt><dd>{dayLabel(usdCnyItem.point.t)}</dd></div>
              </dl>
              <small>{t.macroCalendar.dailyObservation} / {usdCnyItem.metric.source || "FRED"}</small>
            </div>
          ) : null}
        </div>
      ) : (
        <p>{isClosed ? copy.marketClosed : t.macroCalendar.noIndicators}</p>
      )}
    </aside>
  );
}

function EquityMarketMonthCalendar({ dataset, visibleMonth, setVisibleMonth, selectedDate, setSelectedDate, language, t }) {
  const copy = equityCopy(t);
  const byDate = useMemo(() => equityDaysByDate(dataset), [dataset]);
  const days = useMemo(() => monthGrid(visibleMonth), [visibleMonth]);
  const selectedRow = byDate.get(selectedDate);
  return (
    <section className="visualization equity-calendar-section" aria-label={copy.monthCalendarTitle}>
      <div className="macro-section-heading">
        <div>
          <p>{copy.currentMonth}</p>
          <h2>{copy.monthCalendarTitle}</h2>
        </div>
        <div className="macro-month-controls">
          <button type="button" onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}>{copy.previousMonth}</button>
          <strong>{monthTitle(visibleMonth, language)}</strong>
          <button type="button" onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}>{copy.nextMonth}</button>
        </div>
      </div>
      <div className="macro-month-shell equity-month-shell">
        <div className="macro-month-weekdays">
          {t.macroCalendar.weekdays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="macro-month-grid">
          {days.map((day) => {
            const row = byDate.get(day.dateKey);
            const hasData = row?.isMarketDay && Object.values(row.assets || {}).some(Boolean);
            const isClosed = day.inMonth && row && !row.isMarketDay;
            return (
              <button
                type="button"
                key={day.dateKey}
                onClick={() => setSelectedDate(day.dateKey)}
                className={[
                  "macro-month-day",
                  "equity-month-day",
                  day.inMonth ? "" : "is-muted",
                  day.isToday ? "is-today" : "",
                  selectedDate === day.dateKey ? "is-selected" : "",
                  hasData ? "has-items" : "",
                ].filter(Boolean).join(" ")}
              >
                <strong>{day.dayOfMonth}</strong>
                <span className="macro-month-items">
                  {hasData ? EQUITY_ASSET_KEYS.map((symbol) => {
                    const asset = row.assets?.[symbol];
                    return asset ? (
                      <small className={`macro-month-tag equity-month-tag ${equityDirectionClass(asset)}`} key={symbol}>
                        <span>{equityAssetLabel(dataset, symbol, t)}</span>
                        <strong className="equity-month-arrow">{equityDirectionSymbol(asset)}</strong>
                      </small>
                    ) : null;
                  }) : null}
                  {hasData ? ["DGS10", "VIXCLS"].map((seriesId) => {
                    const item = row.macro?.[seriesId];
                    const label = seriesId === "DGS10" ? copy.tenYear : copy.vix;
                    const move = seriesId === "DGS10" ? item?.changeBp : item?.change;
                    return item ? (
                      <small className={`macro-month-tag equity-month-tag ${macroClass(move)}`} key={seriesId}>
                        {label} {formatEquityMacroChange(seriesId, item)}
                      </small>
                    ) : null;
                  }) : isClosed ? (
                    <small className="macro-month-tag equity-month-tag equity-market-closed-tag">{copy.marketClosed}</small>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <EquityDateDetails dateKey={selectedDate} row={selectedRow} dataset={dataset} t={t} />
    </section>
  );
}

function EquityCell({
  week,
  columnKey,
  value,
  children,
  hover,
  setHover,
  setTooltip,
  onSelect,
  className = "",
}) {
  const classNames = [
    "heat-cell",
    Number.isFinite(value) ? returnClass(value) : "return-na",
    hover?.rowKey === week.weekKey ? "cross-row" : "",
    hover?.columnKey === columnKey ? "cross-column" : "",
    className,
  ].filter(Boolean).join(" ");
  const revealTooltip = (event) => {
    setTooltip({ x: event.clientX, y: event.clientY, week, columnKey, value });
  };
  return (
    <td
      className={classNames}
      tabIndex={0}
      role="button"
      aria-label={`${week.weekKey} ${columnKey} ${Number.isFinite(value) ? formatPct(value, 2) : "N/A"}`}
      onMouseEnter={(event) => {
        setHover({ rowKey: week.weekKey, columnKey });
        revealTooltip(event);
      }}
      onMouseMove={revealTooltip}
      onMouseLeave={() => {
        setHover(null);
        setTooltip(null);
      }}
      onClick={() => onSelect(week)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(week);
        }
      }}
    >
      {children ?? (Number.isFinite(value) ? formatPct(value, 1) : "N/A")}
    </td>
  );
}

function EquitySummaryStrip({ dataset, t }) {
  const latest = dataset.weeks.at(-1);
  const tenYear = latestMacro(latest, "DGS10");
  const vix = latestMacro(latest, "VIXCLS");
  const cards = [
    {
      label: t.equity.qqq,
      value: formatCompactPrice(latest.assets.QQQ?.close),
      delta: formatPct(latest.assets.QQQ?.pct, 2),
      className: latest.assets.QQQ?.pct >= 0 ? "positive" : "negative",
      note: latest.assets.QQQ?.tradingEnd,
    },
    {
      label: t.equity.spy,
      value: formatCompactPrice(latest.assets.SPY?.close),
      delta: formatPct(latest.assets.SPY?.pct, 2),
      className: latest.assets.SPY?.pct >= 0 ? "positive" : "negative",
      note: latest.assets.SPY?.tradingEnd,
    },
    {
      label: t.equity.relative,
      value: formatPct(latest.relativePct, 2),
      delta: latest.leader || "N/A",
      className: latest.relativePct >= 0 ? "positive" : "negative",
      note: t.equity.latestWeek,
    },
    {
      label: "10Y / VIX",
      value: `${formatBp(tenYear?.changeBp)} / ${formatSignedNumber(vix?.change, 2)}`,
      delta: `VIX ${formatNumber(vix?.end, 2)}`,
      className: macroClass(vix?.change),
      note: latest.weekKey,
    },
  ];
  return (
    <div className="latest-strip equity-strip" aria-label={t.equity.latestWeek}>
      {cards.map((card) => (
        <div className="equity-summary-card" key={card.label}>
          <span className="ticker">{card.label}</span>
          <span className="latest-price">{card.value}</span>
          <span className={`latest-return ${card.className}`}>{card.delta}</span>
          <small>{card.note}</small>
        </div>
      ))}
    </div>
  );
}

function EquityTable({ rows, hover, setHover, setTooltip, onSelect, t }) {
  return (
    <div className="table-shell equity-shell">
      <table className="data-table equity-table">
        <caption className="sr-only">{t.equity.tableCaption}</caption>
        <thead>
          <tr>
            <th className="week-column">{t.equity.week}</th>
            <th className={hover?.columnKey === "QQQ" ? "cross-column" : ""}>{t.equity.qqqReturn}</th>
            <th className={hover?.columnKey === "SPY" ? "cross-column" : ""}>{t.equity.spyReturn}</th>
            <th className={hover?.columnKey === "relative" ? "cross-column" : ""}>{t.equity.relativeReturn}</th>
            <th>{t.equity.tenYear}</th>
            <th>{t.equity.vix}</th>
            <th>{t.equity.leader}</th>
            <th>{t.equity.events}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((week) => {
            const tenYear = latestMacro(week, "DGS10");
            const vix = latestMacro(week, "VIXCLS");
            const tradingStart = week.assets.QQQ?.tradingStart || week.assets.SPY?.tradingStart || week.weekStart;
            const tradingEnd = week.assets.QQQ?.tradingEnd || week.assets.SPY?.tradingEnd || week.weekEnd;
            return (
              <tr key={week.weekKey}>
                <th scope="row" className={hover?.rowKey === week.weekKey ? "cross-row" : ""}>
                  <button type="button" onClick={() => onSelect(week)}>
                    <strong>{week.weekKey}</strong>
                    <span>{tradingStart} → {tradingEnd}</span>
                  </button>
                </th>
                <EquityCell week={week} columnKey="QQQ" value={week.assets.QQQ?.pct} hover={hover} setHover={setHover} setTooltip={setTooltip} onSelect={onSelect} />
                <EquityCell week={week} columnKey="SPY" value={week.assets.SPY?.pct} hover={hover} setHover={setHover} setTooltip={setTooltip} onSelect={onSelect} />
                <EquityCell week={week} columnKey="relative" value={week.relativePct} hover={hover} setHover={setHover} setTooltip={setTooltip} onSelect={onSelect} />
                <td className={macroClass(tenYear?.changeBp)}>{formatBp(tenYear?.changeBp)}</td>
                <td className={macroClass(vix?.change)}>{formatNumber(vix?.change, 2)}</td>
                <td className={`leader-cell ${week.leader === "QQQ" ? "asset-eth" : "asset-btc"}`}>{week.leader || "N/A"}</td>
                <td className="event-cell">{week.events?.length ? week.events.length : t.equity.noEvents}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="table-note">{t.equity.method}</div>
    </div>
  );
}

function EquityDetailBand({ selected, dataset, t }) {
  if (!selected) {
    return (
      <aside className="detail-band detail-empty equity-detail-empty" aria-live="polite">
        <strong>{t.equity.emptyDetailTitle}</strong>
        <span>{t.equity.emptyDetailBody}</span>
      </aside>
    );
  }
  const tenYear = latestMacro(selected, "DGS10");
  const vix = latestMacro(selected, "VIXCLS");
  return (
    <aside className="detail-band equity-detail-band" aria-live="polite">
      <div>
        <small>{t.equity.selectedWeek}</small>
        <strong>{selected.weekKey}</strong>
      </div>
      <div>
        <small>{t.equity.tradingDays}</small>
        <strong>{selected.assets.QQQ?.tradingStart} → {selected.assets.QQQ?.tradingEnd}</strong>
      </div>
      <div>
        <small>{t.equity.qqqReturn}</small>
        <strong className={selected.assets.QQQ?.pct >= 0 ? "positive" : "negative"}>{formatPct(selected.assets.QQQ?.pct, 2)}</strong>
      </div>
      <div>
        <small>{t.equity.spyReturn}</small>
        <strong className={selected.assets.SPY?.pct >= 0 ? "positive" : "negative"}>{formatPct(selected.assets.SPY?.pct, 2)}</strong>
      </div>
      <div>
        <small>{t.equity.relativeReturn}</small>
        <strong className={selected.relativePct >= 0 ? "positive" : "negative"}>{formatPct(selected.relativePct, 2)}</strong>
      </div>
      <div>
        <small>{t.equity.tenYear}</small>
        <strong className={macroClass(tenYear?.changeBp)}>{formatBp(tenYear?.changeBp)}</strong>
      </div>
      <div>
        <small>{t.equity.vix}</small>
        <strong className={macroClass(vix?.change)}>{formatNumber(vix?.change, 2)}</strong>
      </div>
      <div>
        <small>{t.equity.leader}</small>
        <strong>{selected.leader || "N/A"}</strong>
      </div>
      <div>
        <small>{t.equity.dataSource}</small>
        <strong>{dataset.assets.QQQ.sourceLabel}</strong>
      </div>
      <div className="ranking-line">
        <small>{t.equity.events}</small>
        <strong>{selected.events?.length ? selected.events.map((event) => event.title).join("  ") : t.equity.eventPlaceholder}</strong>
      </div>
    </aside>
  );
}

function EquityTooltip({ value, t }) {
  if (!value?.week) return null;
  const week = value.week;
  const tenYear = latestMacro(week, "DGS10");
  const vix = latestMacro(week, "VIXCLS");
  return (
    <div
      className="cell-tooltip equity-tooltip"
      style={{
        left: Math.max(8, Math.min(value.x + 14, window.innerWidth - 312)),
        top: Math.max(8, Math.min(value.y + 14, window.innerHeight - 210)),
      }}
    >
      <strong>{week.weekKey}</strong>
      <span>{t.equity.qqq}: {formatPct(week.assets.QQQ?.pct, 2)} / {formatCompactPrice(week.assets.QQQ?.close)}</span>
      <span>{t.equity.spy}: {formatPct(week.assets.SPY?.pct, 2)} / {formatCompactPrice(week.assets.SPY?.close)}</span>
      <span>{t.equity.relative}: {formatPct(week.relativePct, 2)}</span>
      <span>{t.equity.tenYear}: {formatBp(tenYear?.changeBp)} · {t.equity.vix}: {formatNumber(vix?.change, 2)}</span>
      <small>{week.events?.length ? `${week.events.length} ${t.equity.events}` : t.equity.noEvents}</small>
    </div>
  );
}

function EquityMacroPage({ language, setLanguage, t }) {
  const copy = equityCopy(t);
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState(null);
  const [visibleWeekDate, setVisibleWeekDate] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const todayKey = useAutoLocalDateKey();

  useEffect(() => {
    const controller = new AbortController();
    const fetchJson = (path, required = true) => fetch(appUrl(path), { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          const loadError = new Error("data-file");
          loadError.status = response.status;
          throw loadError;
        }
        return response.json();
      })
      .catch((loadError) => {
        if (!required && loadError.name !== "AbortError") return null;
        throw loadError;
      });
    Promise.all([
      fetchJson("data/equity-weekly.json"),
      fetchJson("data/equity-fast.json", false),
      fetchJson("data/chart-series.json", false),
    ])
      .then(([loadedDataset, fastDataset, chartSeriesDataset]) => {
        setDataset({ ...loadedDataset, fast: fastDataset, chartSeries: chartSeriesDataset });
        setError(null);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError({ status: loadError.status, message: loadError.message });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    replaceHashState("equity-macro", {});
  }, []);

  useEffect(() => {
    if (!dataset) return;
    const focusDate = todayKey || latestEquityDate(dataset);
    const latestDate = latestEquityDate(dataset);
    setVisibleWeekDate(focusDate);
    setVisibleMonth(monthKeyFromDateKey(focusDate));
    setSelectedDate((current) => current || latestDate || focusDate);
  }, [dataset, todayKey]);

  if (error) {
    return <main className="status-page"><h1>{copy.unavailable}</h1><p>{error.status ? `${t.status.dataFileFailed} (${error.status})` : error.message}</p></main>;
  }
  if (!dataset) {
    return <main className="status-page"><p>{copy.loading}</p></main>;
  }
  const failureCount = [...(dataset.failures || []), ...(dataset.fast?.failures || [])].length;

  return (
    <main className="app-page equity-page">
      <header className="app-header">
        <div className="title-block">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1><span>{copy.titleAccent}</span> {copy.titleRest}</h1>
          <p>{copy.subtitle}</p>
          <PageNav page="equity" t={t} />
        </div>
        <div className="freshness-block">
          <LanguageToggle language={language} onChange={setLanguage} t={t} />
          <CacheStatus label={copy.cache} tooltip={copy.cacheTooltip} />
          <strong>{freshnessLabel(dataset.fast?.generatedAt || dataset.generatedAt, language)}</strong>
          <small>{failureCount ? copy.failure(failureCount) : copy.success}</small>
        </div>
      </header>

      <EquityMarketSummary dataset={dataset} t={t} />
      <MetricComparePanel chartDataset={dataset.chartSeries} language={language} t={t} />

      {visibleWeekDate ? (
        <EquityMarketWeekCalendar
          dataset={dataset}
          visibleWeekDate={visibleWeekDate}
          setVisibleWeekDate={setVisibleWeekDate}
          t={t}
        />
      ) : null}

      {visibleMonth ? (
        <EquityMarketMonthCalendar
          dataset={dataset}
          visibleMonth={visibleMonth}
          setVisibleMonth={setVisibleMonth}
          selectedDate={selectedDate || latestEquityDate(dataset)}
          setSelectedDate={setSelectedDate}
          language={language}
          t={t}
        />
      ) : null}

      <DataTrustFooter
        t={t}
        language={language}
        generatedAt={dataset.fast?.generatedAt || dataset.generatedAt}
        failures={failureCount}
        sources={[
          `QQQ / SPY / DIA - ${dataset.assets.QQQ.sourceLabel}`,
          "FRED - DGS10 / VIXCLS / DEXCHUS / Gold proxy",
          "CoinMarketCap when configured",
          "Built-in NYSE holiday rules",
        ]}
        methodology={language === "zh" ? copy.methodology : [copy.methodology, dataset.fast?.methodology]}
        limitations={[copy.priceSourceNote, copy.eventPlaceholder]}
      />

    </main>
  );
}

const MARKET_CLOCK_SOON_MINUTES = 60;

function getInitialShowCrypto() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem("cycle-map-hide-crypto") !== "1";
  } catch {
    return true;
  }
}

function minutesFromTime(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return (Number(hour) || 0) * 60 + (Number(minute) || 0);
}

function zonedClockParts(timeZone, now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return {
    weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function isWeekday(weekday) {
  return weekday >= 1 && weekday <= 5;
}

function localClockLabel(timeZone, language, now) {
  const locale = language === "en" ? "en-US" : "zh-CN";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

function marketStatus(market, now, language, copy) {
  if (market.stateModel === "always_open") {
    return {
      key: "trading",
      label: copy.status.trading,
      active: true,
      sortRank: 0,
      localTime: copy.alwaysOpen,
      nextText: copy.alwaysOpen,
    };
  }

  const clock = zonedClockParts(market.timezone, now);
  const localTime = localClockLabel(market.timezone, language, now);
  const regularOpen = minutesFromTime(market.regularOpen);
  const regularClose = minutesFromTime(market.regularClose);
  const isTradingDay = isWeekday(clock.weekday);
  if (!isTradingDay) {
    return { key: "closed", label: copy.status.closed, active: false, sortRank: 4, localTime, nextText: market.regularOpen || "N/A" };
  }

  if (market.stateModel === "premarket_regular_afterhours") {
    const premarketOpen = minutesFromTime(market.premarketOpen);
    const afterhoursClose = minutesFromTime(market.afterhoursClose);
    if (clock.minutes >= premarketOpen && clock.minutes < regularOpen) {
      return { key: "premarket", label: copy.status.premarket, active: true, sortRank: 1, localTime, nextText: market.regularOpen };
    }
    if (clock.minutes >= regularOpen && clock.minutes < regularClose) {
      return { key: "open", label: copy.status.open, active: true, sortRank: 1, localTime, nextText: market.regularClose };
    }
    if (clock.minutes >= regularClose && clock.minutes < afterhoursClose) {
      return { key: "afterhours", label: copy.status.afterhours, active: true, sortRank: 2, localTime, nextText: market.afterhoursClose };
    }
    if (clock.minutes < premarketOpen && premarketOpen - clock.minutes <= MARKET_CLOCK_SOON_MINUTES) {
      return { key: "soon", label: copy.status.soon, active: true, sortRank: 1, localTime, nextText: market.premarketOpen };
    }
    return { key: "closed", label: copy.status.closed, active: false, sortRank: 4, localTime, nextText: market.premarketOpen };
  }

  if (market.stateModel === "china_auction_regular_afterhours") {
    const auctionOpen = minutesFromTime(market.auctionOpen);
    const lunchStart = minutesFromTime(market.lunchStart);
    const lunchEnd = minutesFromTime(market.lunchEnd);
    const closingAuctionOpen = minutesFromTime(market.closingAuctionOpen);
    const afterhoursClose = minutesFromTime(market.afterhoursClose);
    if (clock.minutes >= auctionOpen && clock.minutes < regularOpen) {
      return { key: "opening-auction", label: copy.status.openingAuction, active: true, sortRank: 1, localTime, nextText: market.regularOpen };
    }
    if (clock.minutes >= regularOpen && clock.minutes < lunchStart) {
      return { key: "open", label: copy.status.open, active: true, sortRank: 1, localTime, nextText: market.lunchStart };
    }
    if (clock.minutes >= lunchStart && clock.minutes < lunchEnd) {
      return { key: "lunch", label: copy.status.lunch, active: true, sortRank: 1, localTime, nextText: market.lunchEnd };
    }
    if (clock.minutes >= lunchEnd && clock.minutes < closingAuctionOpen) {
      return { key: "open", label: copy.status.open, active: true, sortRank: 1, localTime, nextText: market.closingAuctionOpen };
    }
    if (clock.minutes >= closingAuctionOpen && clock.minutes < regularClose) {
      return { key: "closing-auction", label: copy.status.closingAuction, active: true, sortRank: 1, localTime, nextText: market.regularClose };
    }
    if (clock.minutes >= regularClose && clock.minutes < afterhoursClose) {
      return { key: "afterhours", label: copy.status.afterhours, active: true, sortRank: 2, localTime, nextText: market.afterhoursClose };
    }
    if (clock.minutes < auctionOpen && auctionOpen - clock.minutes <= MARKET_CLOCK_SOON_MINUTES) {
      return { key: "soon", label: copy.status.soon, active: true, sortRank: 1, localTime, nextText: market.auctionOpen };
    }
    return { key: "closed", label: copy.status.closed, active: false, sortRank: 4, localTime, nextText: market.auctionOpen };
  }

  if (market.stateModel === "regular_with_lunch") {
    const lunchStart = minutesFromTime(market.lunchStart);
    const lunchEnd = minutesFromTime(market.lunchEnd);
    if (clock.minutes >= regularOpen && clock.minutes < lunchStart) {
      return { key: "open", label: copy.status.open, active: true, sortRank: 1, localTime, nextText: market.lunchStart };
    }
    if (clock.minutes >= lunchStart && clock.minutes < lunchEnd) {
      return { key: "lunch", label: copy.status.lunch, active: true, sortRank: 1, localTime, nextText: market.lunchEnd };
    }
    if (clock.minutes >= lunchEnd && clock.minutes < regularClose) {
      return { key: "open", label: copy.status.open, active: true, sortRank: 1, localTime, nextText: market.regularClose };
    }
    if (clock.minutes < regularOpen && regularOpen - clock.minutes <= MARKET_CLOCK_SOON_MINUTES) {
      return { key: "soon", label: copy.status.soon, active: true, sortRank: 1, localTime, nextText: market.regularOpen };
    }
    return { key: "closed", label: copy.status.closed, active: false, sortRank: 4, localTime, nextText: market.regularOpen };
  }

  if (clock.minutes >= regularOpen && clock.minutes < regularClose) {
    return { key: "open", label: copy.status.open, active: true, sortRank: 1, localTime, nextText: market.regularClose };
  }
  if (clock.minutes < regularOpen && regularOpen - clock.minutes <= MARKET_CLOCK_SOON_MINUTES) {
    return { key: "soon", label: copy.status.soon, active: true, sortRank: 1, localTime, nextText: market.regularOpen };
  }
  return { key: "closed", label: copy.status.closed, active: false, sortRank: 4, localTime, nextText: market.regularOpen };
}

function marketDisplayName(market, language) {
  return language === "en" ? market.displayName : market.displayNameZh || market.displayName;
}

function marketClockStatuses(dataset, now, language, copy) {
  return Object.fromEntries((dataset?.markets || []).map((market) => [market.id, marketStatus(market, now, language, copy)]));
}

function marketClockRows(dataset, statuses, showCrypto) {
  const marketOrder = new Map((dataset?.markets || []).map((market, index) => [market.id, index]));
  const markets = new Map((dataset?.markets || []).map((market) => [market.id, market]));
  return (dataset?.assets || [])
    .filter((asset) => showCrypto || asset.market !== "crypto")
    .map((asset) => ({
      asset,
      market: markets.get(asset.market),
      status: statuses[asset.market] || { key: "closed", label: "Closed", sortRank: 4 },
    }))
    .sort((a, b) => {
      const aRank = a.asset.market === "crypto" ? 0 : a.status.sortRank;
      const bRank = b.asset.market === "crypto" ? 0 : b.status.sortRank;
      if (aRank !== bRank) return aRank - bRank;
      const marketDiff = (marketOrder.get(a.asset.market) ?? 99) - (marketOrder.get(b.asset.market) ?? 99);
      if (marketDiff) return marketDiff;
      return a.asset.symbol.localeCompare(b.asset.symbol);
    });
}

function formatClockPrice(asset, copy) {
  if (asset?.price === null || asset?.price === undefined || asset?.price === "" || !Number.isFinite(Number(asset.price))) return copy.unavailableValue;
  const value = Number(asset.price);
  const digits = Math.abs(value) < 1 ? 4 : Math.abs(value) < 100 ? 2 : 2;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: value < 1 ? 4 : 0 }).format(value)} ${asset.quote}`;
}

function formatMarketCapUsd(value, copy) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return copy.unavailableValue;
  const number = Number(value);
  const units = [
    [1_000_000_000_000, "T"],
    [1_000_000_000, "B"],
    [1_000_000, "M"],
  ];
  const unit = units.find(([threshold]) => Math.abs(number) >= threshold);
  if (!unit) return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number)} USD`;
  return `${(number / unit[0]).toFixed(number / unit[0] >= 100 ? 0 : 1)}${unit[1]} USD`;
}

function marketCapLabel(asset, copy) {
  if (asset.marketCapStatus === "not_applicable") return copy.notApplicable;
  return formatMarketCapUsd(asset.marketCapUsd, copy);
}

function assetDisplayName(asset, language) {
  return language === "en" ? asset.name : asset.nameZh || asset.name;
}

function qualityLabel(asset, copy) {
  if (asset.sourceKind === "pending" || !Number.isFinite(Number(asset.price))) return copy.sourcePending;
  if (asset.sourceKind === "proxy") return "Proxy";
  return "OK";
}

function qualityText(asset) {
  const notes = [];
  if (asset.quality) notes.push(asset.quality);
  if (asset.changeBasis) notes.push(`Change basis: ${asset.changeBasis}.`);
  if (asset.marketCapStatus === "unavailable") notes.push("Market cap unavailable from the current reviewed source.");
  if (asset.marketCapStatus === "not_applicable") notes.push("Market cap does not apply to this proxy/index instrument.");
  return notes.join(" ");
}

function sourceTimeLabel(iso, language) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    timeZone: language === "en" ? "America/New_York" : "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function MarketClockSummary({ dataset, statuses, language, copy }) {
  return (
    <section className="market-clock-summary" aria-label={copy.marketState}>
      {(dataset.markets || []).map((market) => {
        const status = statuses[market.id];
        return (
          <div className={`market-state-card state-${status?.key || "closed"} market-${market.id}`} key={market.id}>
            <small>{marketDisplayName(market, language)}</small>
            <strong>{status?.label || copy.status.closed}</strong>
            <span>{copy.localTime}: {status?.localTime || "N/A"}</span>
            <em>{copy.next}: {status?.nextText || "N/A"}</em>
          </div>
        );
      })}
    </section>
  );
}

function MarketClockTable({ rows, selected, onSelect, language, copy }) {
  return (
    <div className="table-shell market-clock-shell">
      <table className="data-table market-clock-table">
        <caption className="sr-only">{copy.assetList}</caption>
        <thead>
          <tr>
            <th>{copy.table.market}</th>
            <th>{copy.table.asset}</th>
            <th>{copy.table.status}</th>
            <th>{copy.table.price}</th>
            <th>{copy.table.change}</th>
            <th>{copy.table.marketCap}</th>
            <th>{copy.table.source}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map(({ asset, market, status }) => {
            const isSelected = selected?.symbol === asset.symbol;
            return (
              <tr className={`${isSelected ? "selected-row" : ""} state-${status.key}`} key={asset.symbol}>
                <th scope="row">
                  <button type="button" onClick={() => onSelect(asset)}>
                    <strong>{market ? marketDisplayName(market, language) : asset.market}</strong>
                    <span>{market?.timezone || "UTC"}</span>
                  </button>
                </th>
                <td>
                  <button type="button" className="market-asset-button" onClick={() => onSelect(asset)}>
                    <strong>{asset.symbol}</strong>
                    <span>{assetDisplayName(asset, language)}</span>
                  </button>
                </td>
                <td><span className={`market-status-pill state-${status.key}`}>{status.label}</span></td>
                <td>{formatClockPrice(asset, copy)}</td>
                <td className={Number(asset.changePct) >= 0 ? "positive" : Number(asset.changePct) < 0 ? "negative" : ""}>{formatPct(asset.changePct, 2)}</td>
                <td>{marketCapLabel(asset, copy)}</td>
                <td>
                  <button type="button" className={`quality-badge source-${asset.sourceKind || "available"}`} title={qualityText(asset)} onClick={() => onSelect(asset)}>
                    {qualityLabel(asset, copy)}
                  </button>
                </td>
              </tr>
            );
          }) : (
            <tr>
              <td colSpan="7" className="empty-table-cell">{copy.table.noRows}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="table-note">{copy.sourceNote}</div>
    </div>
  );
}

function MarketClockDetail({ selected, copy, language }) {
  if (!selected) {
    return (
      <aside className="detail-band detail-empty market-clock-detail-empty" aria-live="polite">
        <strong>{copy.detail.emptyTitle}</strong>
        <span>{copy.detail.emptyBody}</span>
      </aside>
    );
  }
  const components = selected.components?.length
    ? selected.components.map((component) => `${component.exchange} ${component.symbol} ${Number.isFinite(component.weight) ? `${Math.round(component.weight * 100)}%` : ""}`).join(" / ")
    : "N/A";
  return (
    <aside className="detail-band market-clock-detail" aria-live="polite">
      <div>
        <small>{copy.detail.selected}</small>
        <strong>{selected.symbol}</strong>
      </div>
      <div>
        <small>{copy.detail.pair}</small>
        <strong>{selected.localQuote ? `${selected.localQuote} → ${selected.quote}` : selected.quote}</strong>
      </div>
      <div>
        <small>{copy.table.price}</small>
        <strong>{formatClockPrice(selected, copy)}</strong>
      </div>
      <div>
        <small>{copy.table.marketCap}</small>
        <strong>{marketCapLabel(selected, copy)}</strong>
      </div>
      <div>
        <small>{copy.detail.priceSource}</small>
        <strong>{selected.sourceLabel || "N/A"}</strong>
      </div>
      <div>
        <small>{copy.detail.capSource}</small>
        <strong>{selected.marketCapSourceLabel || (selected.marketCapStatus === "not_applicable" ? copy.notApplicable : copy.sourcePending)}</strong>
      </div>
      <div>
        <small>{copy.detail.updated}</small>
        <strong>{sourceTimeLabel(selected.asOf || selected.marketCapAsOf, language)}</strong>
      </div>
      <div className="ranking-line">
        <small>{copy.detail.quality}</small>
        <strong>{qualityText(selected) || "N/A"}</strong>
      </div>
      <div className="ranking-line">
        <small>{copy.detail.components}</small>
        <strong>{components}</strong>
      </div>
    </aside>
  );
}

function MarketClockPage({ language, setLanguage, t }) {
  const copy = marketClockCopy(t);
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [showCrypto, setShowCrypto] = useState(getInitialShowCrypto);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(appUrl("data/market-session.json"), { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          const loadError = new Error("data-file");
          loadError.status = response.status;
          throw loadError;
        }
        return response.json();
      })
      .then((loadedDataset) => {
        setDataset(loadedDataset);
        setError(null);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError({ status: loadError.status, message: loadError.message });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    replaceHashState("market-clock", {});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("cycle-map-hide-crypto", showCrypto ? "0" : "1");
    } catch {
      // Preference persistence is optional.
    }
    if (!showCrypto && selected?.market === "crypto") setSelected(null);
  }, [showCrypto, selected]);

  const statuses = useMemo(() => dataset ? marketClockStatuses(dataset, now, language, copy) : {}, [dataset, now, language, copy]);
  const rows = useMemo(() => dataset ? marketClockRows(dataset, statuses, showCrypto) : [], [dataset, statuses, showCrypto]);

  if (error) {
    return <main className="status-page"><h1>{copy.unavailable}</h1><p>{error.status ? `${t.status.dataFileFailed} (${error.status})` : error.message}</p></main>;
  }
  if (!dataset) {
    return <main className="status-page"><p>{copy.loading}</p></main>;
  }

  return (
    <main className="app-page market-clock-page">
      <header className="app-header">
        <div className="title-block">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1><span>{copy.titleAccent}</span> {copy.titleRest}</h1>
          <p>{copy.subtitle}</p>
          <PageNav page="marketClock" t={t} />
        </div>
        <div className="freshness-block">
          <LanguageToggle language={language} onChange={setLanguage} t={t} />
          <CacheStatus label={copy.cache} tooltip={copy.cacheTooltip} />
          <strong>{freshnessLabel(dataset.generatedAt, language)}</strong>
          <small>{dataset.failures?.length ? copy.failure(dataset.failures.length) : copy.success}</small>
        </div>
      </header>

      <MarketClockSummary dataset={dataset} statuses={statuses} language={language} copy={copy} />

      <section className="control-bar market-clock-controls" aria-label={copy.controls}>
        <div className="control-primary">
          <button type="button" className={showCrypto ? "market-toggle is-active" : "market-toggle"} onClick={() => setShowCrypto((value) => !value)}>
            {showCrypto ? copy.hideCrypto : copy.showCrypto}
          </button>
        </div>
        <div className="control-secondary">
          <span className="market-clock-hidden-note">{showCrypto ? "" : copy.cryptoHidden}</span>
        </div>
      </section>

      <section className="visualization market-clock-section" aria-label={copy.assetList}>
        <div className="visualization-heading">
          <div>
            <p>{copy.marketState}</p>
            <h2>{copy.assetList}</h2>
          </div>
          <p className="method-note">{dataset.refreshCadence}</p>
        </div>
        <MarketClockTable rows={rows} selected={selected} onSelect={setSelected} language={language} copy={copy} />
      </section>

      <MarketClockDetail selected={selected} copy={copy} language={language} />

      <DataTrustFooter
        t={t}
        language={language}
        generatedAt={dataset.generatedAt}
        failures={dataset.failures}
        sources={[
          "OKX public market data",
          "CoinMarketCap market caps",
          "Local session clock rules",
        ]}
        methodology={copy.methodology || dataset.methodology}
        limitations={copy.sourceNote}
      />
    </main>
  );
}

function CryptoCyclePage({ language, setLanguage, t }) {
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState(null);
  const [cryptoState, setCryptoState] = useState(readCryptoStateFromHash);
  const [hover, setHover] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [selected, setSelected] = useState(null);
  const { view, metric, range, asset } = cryptoState;

  useEffect(() => {
    const controller = new AbortController();
    fetch(appUrl("data/market-monthly.json"), { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          const loadError = new Error("data-file");
          loadError.status = response.status;
          throw loadError;
        }
        return response.json();
      })
      .then((loadedDataset) => {
        setDataset(loadedDataset);
        setError(null);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") {
          setError({ status: loadError.status, message: loadError.message });
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      if (currentPage() !== "crypto") return;
      setCryptoState(readCryptoStateFromHash());
      setHover(null);
      setTooltip(null);
      setSelected(null);
    };
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    replaceHashState("", cryptoState);
  }, [cryptoState]);

  const assetMaps = useMemo(() => dataset ? makeAssetMaps(dataset) : null, [dataset]);
  const rotationRows = useMemo(
    () => dataset && assetMaps ? buildRotationRows(dataset, assetMaps, range, metric) : [],
    [dataset, assetMaps, range, metric],
  );
  const cycleYears = useMemo(
    () => dataset && assetMaps ? buildCycleYears(dataset, assetMaps, asset, metric) : [],
    [dataset, assetMaps, asset, metric],
  );
  const stats = useMemo(() => monthlyStats(cycleYears), [cycleYears]);

  const switchView = (next) => {
    setCryptoState((current) => ({ ...current, view: next }));
    setHover(null);
    setTooltip(null);
    setSelected(null);
  };

  const openAsset = (symbol) => {
    setCryptoState((current) => ({ ...current, asset: symbol, view: "cycle" }));
    setSelected(null);
  };

  const errorText = error
    ? error.status
      ? `${t.status.dataFileFailed} (${error.status})`
      : error.message || t.status.dataLoadFailed
    : "";

  if (error) {
    return <main className="status-page"><h1>{t.status.dataUnavailable}</h1><p>{errorText}</p></main>;
  }
  if (!dataset) {
    return <main className="status-page"><p>{t.status.loading}</p></main>;
  }

  return (
    <main className={`app-page view-${view} ${selected ? "has-mobile-dock" : ""}`}>
      <header className="app-header">
        <div className="title-block">
          <p className="eyebrow">{t.header.eyebrow}</p>
          <h1><span>{t.header.titleAccent}</span> {t.header.titleRest}</h1>
          <p>{t.header.subtitle}</p>
          <PageNav page="crypto" t={t} />
        </div>
        <div className="freshness-block">
          <LanguageToggle language={language} onChange={setLanguage} t={t} />
          <CacheStatus label={t.header.cache} tooltip={t.header.cacheTooltip} />
          <strong>{freshnessLabel(dataset.generatedAt, language)}</strong>
          <small>{dataset.failures?.length ? t.header.failure(dataset.failures.length) : t.header.success}</small>
        </div>
      </header>

      <LatestStrip dataset={dataset} onOpenAsset={openAsset} t={t} />

      <section className="control-bar" aria-label={t.controls.chart}>
        <div className="control-primary">
          <Segmented label={t.controls.view} options={t.options.views} value={view} onChange={switchView} />
        </div>
        <div className="control-secondary">
          <Segmented
            label={t.controls.metric}
            options={t.options.metrics}
            value={metric}
            onChange={(next) => {
              setCryptoState((current) => ({ ...current, metric: next }));
              setSelected(null);
            }}
            compact
          />
          {view === "rotation" ? (
            <Segmented
              label={t.controls.range}
              options={t.options.ranges}
              value={range}
              onChange={(next) => {
                setCryptoState((current) => ({ ...current, range: next }));
                setSelected(null);
              }}
              compact
            />
          ) : null}
        </div>
      </section>

      {view === "cycle" ? (
        <>
          <AssetSwitch
            value={asset}
            onChange={(next) => {
              setCryptoState((current) => ({ ...current, asset: next }));
              setSelected(null);
            }}
            t={t}
          />
          <AssetSpotSummary dataset={dataset} symbol={asset} t={t} />
        </>
      ) : null}

      <CryptoInsight
        view={view}
        metric={metric}
        range={range}
        asset={asset}
        dataset={dataset}
        rotationRows={rotationRows}
        selected={selected}
        t={t}
      />

      <section className="visualization" aria-label={view === "rotation" ? t.visualization.rotationAria : t.visualization.cycleAria(asset)}>
        <div className="visualization-heading">
          <div>
            <p>{view === "rotation" ? t.visualization.rotationKicker : t.visualization.cycleKicker}</p>
            <h2>{view === "rotation" ? t.visualization.rotationTitle : t.visualization.cycleTitle(asset)}</h2>
          </div>
          <p className="method-note">
            {metric === "absolute" ? t.visualization.absoluteMethod : t.visualization.relativeMethod}
          </p>
        </div>

        {view === "rotation" ? (
          <RotationTable
            rows={rotationRows}
            metric={metric}
            hover={hover}
            setHover={setHover}
            setTooltip={setTooltip}
            onSelect={setSelected}
            t={t}
          />
        ) : (
          <CycleTable
            years={cycleYears}
            stats={stats}
            asset={asset}
            currentMonthKey={dataset.currentMonthKey}
            hover={hover}
            setHover={setHover}
            setTooltip={setTooltip}
            onSelect={setSelected}
            t={t}
          />
        )}
      </section>

      <DetailBand selected={selected} dataset={dataset} metric={metric} t={t} />
      <Legend t={t} />

      <DataTrustFooter
        t={t}
        language={language}
        generatedAt={dataset.generatedAt}
        failures={dataset.failures}
        sources={[
          "BTC - Blockchain.info / Binance Spot",
          "ETH / SOL - Binance Spot",
          "HYPE - Hyperliquid",
        ]}
        methodology={language === "zh" ? (metric === "absolute" ? t.visualization.absoluteMethod : t.visualization.relativeMethod) : dataset.methodology}
        limitations={t.footer.staticCacheOnly}
      />

      <Tooltip value={tooltip} dataset={dataset} t={t} />
      <MobilePinnedDetail selected={selected} dataset={dataset} metric={metric} onClear={() => setSelected(null)} t={t} />
    </main>
  );
}

function localizedField(item, field, language) {
  return item?.[`${field}${language === "en" ? "En" : "Zh"}`] || item?.[field] || "";
}

function chipHeatClass(value) {
  if (!Number.isFinite(value)) return "chip-heat-na";
  if (value >= 8) return "chip-heat-up-4";
  if (value >= 4) return "chip-heat-up-3";
  if (value >= 1.5) return "chip-heat-up-2";
  if (value >= 0) return "chip-heat-up-1";
  if (value > -1.5) return "chip-heat-down-1";
  if (value > -4) return "chip-heat-down-2";
  if (value > -8) return "chip-heat-down-3";
  return "chip-heat-down-4";
}

function chipStageLabel(stage, copy) {
  return copy.stage?.[stage] || stage || "";
}

function chipSourceLabel(asset, copy) {
  if (!asset) return "N/A";
  if (asset.sourceLabel) return asset.sourceLabel;
  return asset.sourceKind === "sample" ? copy.sampleSource : asset.sourceKind || "N/A";
}

function plannedSourceLabel(language) {
  return language === "en" ? "Reviewed backend quote cache" : "经审查的后端行情缓存";
}

function formatMarketCap(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  if (n >= 1000) return `${formatNumber(n / 1000, 2)}T USD`;
  return `${formatNumber(n, n >= 10 ? 0 : 1)}B USD`;
}

function formatWeek52Position(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  return `${Math.round(n * 100)}%`;
}

function hasRealCachedPricePath(asset) {
  const sourceKind = String(asset?.sourceKind || "").toLowerCase();
  const dataQuality = String(asset?.dataQuality || "").toLowerCase();
  if (sourceKind === "sample" || sourceKind === "pending") return false;
  if (dataQuality.includes("sample") || dataQuality.includes("pending")) return false;
  return true;
}

function chipSparkValues(asset, range) {
  if (!hasRealCachedPricePath(asset)) return [];
  return (asset?.pricePaths?.[range] || [])
    .map((point) => Number(point?.c ?? point?.close ?? point?.price ?? point))
    .filter(Number.isFinite);
}

function chipSparkGeometry(values, width = 94, height = 28) {
  const numeric = values.filter(Number.isFinite);
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const spread = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * width : 0;
    const y = height - ((value - min) / spread) * (height - 6) - 3;
    return { x, y };
  });
  return {
    points: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
    end: points[points.length - 1] || { x: 0, y: height / 2 },
    midY: height / 2,
  };
}

function ChipSparkline({ asset, range }) {
  const returnPct = Number(asset?.returns?.[range]);
  const values = chipSparkValues(asset, range);
  if (values.length < 2) {
    return (
      <span className="chip-sparkline chip-sparkline-empty" title="No real cached price path" aria-hidden="true">
        <span />
      </span>
    );
  }
  const geometry = chipSparkGeometry(values);
  return (
    <span className={`chip-sparkline ${returnPct >= 0 ? "positive" : "negative"}`} aria-hidden="true">
      <svg viewBox="0 0 94 28" focusable="false">
        <polyline className="chip-sparkline-mid" points={`0,${geometry.midY} 94,${geometry.midY}`} />
        <polyline className="chip-sparkline-line" points={geometry.points} />
        <circle className="chip-sparkline-dot" cx={geometry.end.x} cy={geometry.end.y} r="2.2" />
      </svg>
    </span>
  );
}

function chipCategoryRows(dataset, range) {
  const assetMap = dataset?.assets || {};
  return (dataset?.categories || []).map((category) => {
    const assets = (category.tickers || [])
      .map((symbol) => assetMap[symbol])
      .filter(Boolean);
    const values = assets
      .map((asset) => Number(asset.returns?.[range]))
      .filter(Number.isFinite);
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const leader = [...assets]
      .filter((asset) => Number.isFinite(Number(asset.returns?.[range])))
      .sort((a, b) => Number(b.returns?.[range]) - Number(a.returns?.[range]))[0] || null;
    return { category, assets, average, leader };
  }).filter((row) => row.assets.length);
}

function chipTopMovers(rows, range) {
  const seen = new Set();
  const assets = [];
  rows.forEach((row) => {
    row.assets.forEach((asset) => {
      if (!seen.has(asset.symbol)) {
        seen.add(asset.symbol);
        assets.push(asset);
      }
    });
  });
  return assets
    .filter((asset) => Number.isFinite(Number(asset.returns?.[range])))
    .sort((a, b) => Number(b.returns?.[range]) - Number(a.returns?.[range]));
}

function chipTreemapWeight(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.abs(numeric) + 0.25;
}

function splitChipTreemapItems(items, rect) {
  if (!items.length) return [];
  if (items.length === 1) {
    return [{ ...items[0], rect }];
  }
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return [];
  const half = total / 2;
  let running = 0;
  let splitIndex = 1;
  let bestDistance = Infinity;
  for (let index = 0; index < items.length - 1; index += 1) {
    running += items[index].weight;
    const distance = Math.abs(half - running);
    if (distance < bestDistance) {
      bestDistance = distance;
      splitIndex = index + 1;
    }
  }
  const first = items.slice(0, splitIndex);
  const second = items.slice(splitIndex);
  const firstWeight = first.reduce((sum, item) => sum + item.weight, 0);
  const ratio = firstWeight / total;
  if (rect.width >= rect.height) {
    const firstWidth = rect.width * ratio;
    return [
      ...splitChipTreemapItems(first, { ...rect, width: firstWidth }),
      ...splitChipTreemapItems(second, { ...rect, x: rect.x + firstWidth, width: rect.width - firstWidth }),
    ];
  }
  const firstHeight = rect.height * ratio;
  return [
    ...splitChipTreemapItems(first, { ...rect, height: firstHeight }),
    ...splitChipTreemapItems(second, { ...rect, y: rect.y + firstHeight, height: rect.height - firstHeight }),
  ];
}

function chipTreemapTiles(movers, range) {
  const items = movers
    .map((asset) => {
      const value = Number(asset.returns?.[range]);
      return {
        asset,
        value,
        weight: chipTreemapWeight(value),
      };
    })
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight || b.value - a.value || a.asset.symbol.localeCompare(b.asset.symbol));
  return splitChipTreemapItems(items, { x: 0, y: 0, width: 100, height: 100 });
}

function chipTreemapSymbol(symbol) {
  return String(symbol || "").replace(/\.(KS|KQ)$/i, "");
}

function chipTreemapTextClass(value) {
  const magnitude = Math.abs(Number(value));
  if (!Number.isFinite(magnitude)) return "chip-move-text-1";
  if (magnitude >= 7) return "chip-move-text-5";
  if (magnitude >= 4) return "chip-move-text-4";
  if (magnitude >= 2) return "chip-move-text-3";
  if (magnitude >= 0.8) return "chip-move-text-2";
  return "chip-move-text-1";
}

function ChainTreemapSummary({ movers, range, selectedSymbol, onSelect, copy, className = "" }) {
  const tiles = useMemo(() => chipTreemapTiles(movers, range), [movers, range]);
  if (!tiles.length) {
    return (
      <section className={`chip-hotspot-summary chip-treemap-summary ${className}`.trim()} aria-label={copy.latest}>
        <div className="chip-treemap-empty">{copy.noRows}</div>
      </section>
    );
  }
  const selectable = typeof onSelect === "function";
  return (
    <section className={`chip-hotspot-summary chip-treemap-summary ${className}`.trim()} aria-label={copy.latest}>
      {tiles.map(({ asset, value, rect }) => {
        const area = rect.width * rect.height;
        const tinyTile = rect.width < 5 || rect.height < 5 || area < 170;
        const compactTile = !tinyTile && (rect.height < 16 || area < 300 || (rect.width < 10 && area < 360));
        const densityClass = tinyTile ? "is-tiny" : compactTile ? "is-compact" : "";
        const shapeClass = rect.width < 6 || rect.height < 6 ? "is-narrow" : "";
        const TileElement = selectable ? "button" : "div";
        const interactiveProps = selectable
          ? {
              type: "button",
              onClick: () => onSelect(asset.symbol),
              "aria-pressed": selectedSymbol === asset.symbol,
            }
          : {};
        return (
          <TileElement
            {...interactiveProps}
            className={`chip-treemap-tile ${chipHeatClass(value)} ${chipTreemapTextClass(value)} ${densityClass} ${shapeClass} ${selectable ? "" : "is-static"} ${selectedSymbol === asset.symbol ? "is-selected" : ""}`}
            key={asset.symbol}
            aria-label={`${asset.symbol} ${asset.name} ${formatPct(value, 1)}`}
            title={`${asset.symbol} ${asset.name} ${formatPct(value, 1)}`}
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.width}%`,
              height: `${rect.height}%`,
            }}
          >
            <span className="chip-treemap-label">
              <strong>{chipTreemapSymbol(asset.symbol)}</strong>
            </span>
            <em>{formatPct(value, 1)}</em>
          </TileElement>
        );
      })}
    </section>
  );
}

function ChipTickerButton({ asset, range, selected, onSelect, copy }) {
  const value = Number(asset.returns?.[range]);
  return (
    <button
      type="button"
      className={`chip-ticker-button ${chipHeatClass(value)} ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(asset.symbol)}
      aria-pressed={selected}
      title={`${asset.symbol} ${asset.name}`}
    >
      <span>
        <strong>{asset.symbol}</strong>
        <small>{asset.name}</small>
      </span>
      <ChipSparkline asset={asset} range={range} />
      <span>
        <em>{formatPrice(asset.price, asset.quote)}</em>
        <b>{formatPct(value, 1)}</b>
      </span>
    </button>
  );
}

function ChipCategoryCard({ row, range, selectedSymbol, onSelect, language, copy }) {
  const { category, assets, average, leader } = row;
  return (
    <article className={`chip-category-card ${chipHeatClass(average)}`}>
      <header>
        <div>
          <small>{chipStageLabel(category.stage, copy)}</small>
          <h3>{localizedField(category, "title", language)}</h3>
          <p>{localizedField(category, "subtitle", language)}</p>
        </div>
        <div className="chip-category-score">
          <span>{formatPct(average, 1)}</span>
          <small>{leader?.symbol || "N/A"}</small>
        </div>
      </header>
      <div className="chip-structure-tags" aria-label={localizedField(category, "title", language)}>
        {(language === "en" ? category.structureEn : category.structureZh)?.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="chip-ticker-grid">
        {assets.map((asset) => (
          <ChipTickerButton
            asset={asset}
            range={range}
            selected={selectedSymbol === asset.symbol}
            onSelect={onSelect}
            copy={copy}
            key={`${category.id}-${asset.symbol}`}
          />
        ))}
      </div>
    </article>
  );
}

function ChipChainBoard({ rows, range, selectedSymbol, onSelect, language, copy }) {
  if (!rows.length) {
    return <div className="chip-empty-board">{copy.noRows}</div>;
  }
  return (
    <div className="chip-chain-board">
      {rows.map((row) => (
        <ChipCategoryCard
          row={row}
          range={range}
          selectedSymbol={selectedSymbol}
          onSelect={onSelect}
          language={language}
          copy={copy}
          key={row.category.id}
        />
      ))}
    </div>
  );
}

function ChipChainDetail({ asset, category, copy, language }) {
  if (!asset) {
    return (
      <aside className="detail-band detail-empty chip-detail-empty" aria-live="polite">
        <strong>{copy.detailEmptyTitle}</strong>
        <span>{copy.detailEmptyBody}</span>
      </aside>
    );
  }
  const role = language === "en" ? asset.roleEn : asset.roleZh;
  const returnItems = [
    ["1D", asset.returns?.["1d"]],
    ["5D", asset.returns?.["5d"]],
    ["1M", asset.returns?.["1m"]],
    ["3M", asset.returns?.["3m"]],
  ];
  const relativeItems = [
    [copy.vsSoxx, asset.relative?.soxx],
    [copy.vsQqq, asset.relative?.qqq],
  ];
  return (
    <aside className="detail-band chip-detail-band" aria-live="polite">
      <div>
        <small>{copy.selected}</small>
        <strong>{asset.symbol}</strong>
      </div>
      <div>
        <small>{copy.category}</small>
        <strong>{localizedField(category, "title", language)}</strong>
      </div>
      <div>
        <small>{copy.price}</small>
        <strong>{formatPrice(asset.price, asset.quote)}</strong>
      </div>
      <div>
        <small>{copy.returns}</small>
        <strong className="chip-detail-moves">
          {returnItems.map(([label, value]) => (
            <span className={`chip-detail-move ${equityMoveClass(value)}`} key={label}>{label} {formatPct(value, 1)}</span>
          ))}
        </strong>
      </div>
      <div>
        <small>{copy.relative}</small>
        <strong className="chip-detail-moves">
          {relativeItems.map(([label, value]) => (
            <span className={`chip-detail-move ${equityMoveClass(value)}`} key={label}>{label} {formatPct(value, 1)}</span>
          ))}
        </strong>
      </div>
      <div>
        <small>{copy.volume}</small>
        <strong>{formatNumber(asset.volumeRatio, 2)}x</strong>
      </div>
      <div>
        <small>{copy.week52}</small>
        <strong>{formatWeek52Position(asset.week52Position)}</strong>
      </div>
      <div>
        <small>{copy.marketCap}</small>
        <strong>{formatMarketCap(asset.marketCapUsdB)}</strong>
      </div>
      <div>
        <small>{copy.source}</small>
        <strong>{chipSourceLabel(asset, copy)} · {sourceTimeLabel(asset.asOf, language)}</strong>
      </div>
      <div>
        <small>{copy.plannedSource}</small>
        <strong>{plannedSourceLabel(language)}</strong>
      </div>
      <div className="ranking-line">
        <small>{copy.role}</small>
        <strong>{role}</strong>
      </div>
    </aside>
  );
}

function ChipChainPage({ language, setLanguage, t }) {
  const copy = chipChainCopy(t);
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState(null);
  const [chipState, setChipState] = useState(readChipChainStateFromHash);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [selectionCleared, setSelectionCleared] = useState(false);
  const { range } = chipState;

  useEffect(() => {
    const controller = new AbortController();
    fetch(appUrl("data/chip-chain-hotspots.json"), { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          const loadError = new Error("data-file");
          loadError.status = response.status;
          throw loadError;
        }
        return response.json();
      })
      .then((loadedDataset) => {
        setDataset(loadedDataset);
        setError(null);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError({ status: loadError.status, message: loadError.message });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      if (currentPage() !== "chipChain") return;
      setChipState(readChipChainStateFromHash());
    };
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    replaceHashState("chip-chain", chipState);
  }, [chipState]);

  const rows = useMemo(() => chipCategoryRows(dataset, range), [dataset, range]);
  const movers = useMemo(() => chipTopMovers(rows, range), [rows, range]);
  const categoryById = useMemo(() => new Map((dataset?.categories || []).map((category) => [category.id, category])), [dataset]);
  const assetMap = dataset?.assets || {};
  const selectedAsset = selectedSymbol ? assetMap[selectedSymbol] : null;
  const selectedCategory = selectedAsset ? categoryById.get(selectedAsset.primaryCategory) : null;
  const rangeOptions = (dataset?.ranges || []).map((item) => ({ value: item.value, label: item.label }));
  const selectChipSymbol = (symbol) => {
    setSelectionCleared(false);
    setSelectedSymbol(symbol);
  };
  const clearChipSelection = () => {
    setSelectionCleared(true);
    setSelectedSymbol(null);
  };
  const clearChipSelectionOnNonTicker = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".chip-ticker-button, .chip-hotspot-card, .chip-treemap-tile, .chip-detail-band, .chip-detail-empty")) return;
    clearChipSelection();
  };

  useEffect(() => {
    if (!dataset) return;
    if (!movers.length) {
      setSelectedSymbol(null);
      return;
    }
    if (selectionCleared) return;
    if (!selectedSymbol || !movers.some((asset) => asset.symbol === selectedSymbol)) {
      setSelectedSymbol(movers[0].symbol);
    }
  }, [dataset, movers, selectedSymbol, selectionCleared]);

  if (error) {
    return <main className="status-page"><h1>{copy.unavailable}</h1><p>{error.status ? `${t.status.dataFileFailed} (${error.status})` : error.message}</p></main>;
  }
  if (!dataset) {
    return <main className="status-page"><p>{copy.loading}</p></main>;
  }

  return (
    <main className="app-page chip-chain-page" onPointerDown={clearChipSelectionOnNonTicker}>
      <header className="app-header">
        <div className="title-block">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1><span>{copy.titleAccent}</span> {copy.titleRest}</h1>
          <p>{copy.subtitle}</p>
          <PageNav page="chipChain" t={t} />
        </div>
        <div className="freshness-block">
          <LanguageToggle language={language} onChange={setLanguage} t={t} />
          <CacheStatus label={copy.cache} tooltip={copy.cacheTooltip} />
          <strong>{freshnessLabel(dataset.generatedAt, language)}</strong>
          <small>{dataset.failures?.length ? copy.failure(dataset.failures.length) : copy.success}</small>
        </div>
      </header>

      <ChainTreemapSummary movers={movers} range={range} selectedSymbol={selectedSymbol} onSelect={selectChipSymbol} copy={copy} />

      <section className="control-bar chip-chain-controls" aria-label={copy.controls}>
        <div className="control-primary">
          <Segmented label={copy.range} options={rangeOptions} value={range} onChange={(next) => setChipState((current) => ({ ...current, range: next }))} />
        </div>
      </section>

      <section className="visualization chip-chain-section" aria-label={copy.boardTitle}>
        <div className="visualization-heading">
          <div>
            <p>{copy.boardKicker}</p>
            <h2>{copy.boardTitle}</h2>
          </div>
          <p className="method-note">{copy.boardMethod}</p>
        </div>
        <ChipChainBoard rows={rows} range={range} selectedSymbol={selectedSymbol} onSelect={selectChipSymbol} language={language} copy={copy} />
      </section>

      {selectedAsset ? <ChipChainDetail asset={selectedAsset} category={selectedCategory} copy={copy} language={language} /> : null}

      <DataTrustFooter
        t={t}
        language={language}
        generatedAt={dataset.generatedAt}
        failures={dataset.failures}
        sources={[
          plannedSourceLabel(language),
          copy.cacheSource || copy.sampleSource,
        ]}
        methodology={language === "zh" ? copy.boardMethod : dataset.methodology || copy.boardMethod}
        limitations={copy.sourceNote}
      />
    </main>
  );
}

function robotAttributeLabel(attribute, copy) {
  return copy.attributeLabels?.[attribute] || attribute || "N/A";
}

function robotCategoryRows(dataset) {
  const assetMap = dataset?.assets || {};
  return (dataset?.categories || []).map((category) => ({
    category,
    assets: (category.tickers || []).map((symbol) => assetMap[symbol]).filter(Boolean),
  })).filter((row) => row.assets.length);
}

function robotTopMovers(rows, range) {
  const seen = new Set();
  return rows
    .flatMap((row) => row.assets)
    .filter((asset) => {
      if (seen.has(asset.symbol)) return false;
      seen.add(asset.symbol);
      return true;
    })
    .filter((asset) => Number.isFinite(Number(asset.returns?.[range])))
    .sort((a, b) => Number(b.returns?.[range]) - Number(a.returns?.[range]));
}

function RobotChainTable({ rows, range, language, copy }) {
  if (!rows.length) {
    return <div className="chip-empty-board">{copy.noRows}</div>;
  }
  const sectorLabelParts = (row) => {
    if (row.category.id !== "warehouse-service") {
      return [language === "en" ? row.category.labelEn : row.category.labelZh];
    }
    return language === "en" ? ["Warehouse & Service", "Robots"] : ["\u4ed3\u50a8\u4e0e\u670d\u52a1", "\u673a\u5668\u4eba"];
  };
  return (
    <div className="table-shell robot-chain-shell">
      <table className="robot-chain-table">
        <caption className="sr-only">{copy.tableTitle}</caption>
        <thead>
          <tr>
            <th>{copy.sector}</th>
            <th>{copy.company}</th>
            <th>{copy.business}</th>
            <th>{copy.marketCap}</th>
            <th>{copy.attribute}</th>
            <th>{copy.price}</th>
            <th>{copy.change}</th>
            <th>{copy.sparkline}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => row.assets.map((asset, assetIndex) => {
            const value = Number(asset.returns?.[range]);
            const business = language === "en" ? asset.businessEn : asset.businessZh;
            return (
              <tr key={`${row.category.id}-${asset.symbol}`}>
                {assetIndex === 0 ? (
                  <th scope="rowgroup" rowSpan={row.assets.length} className="robot-sector-cell">
                    {sectorLabelParts(row).map((part) => <span className="robot-sector-line" key={part}>{part}</span>)}
                  </th>
                ) : null}
                <td className="robot-company-cell">
                  <strong>{asset.symbol}</strong>
                  <span>{asset.company}</span>
                </td>
                <td className="robot-business-cell">{business}</td>
                <td className="robot-market-cell">{asset.marketCapLabel}</td>
                <td>
                  <span className={`robot-attribute robot-attribute-${asset.attribute}`}>{robotAttributeLabel(asset.attribute, copy)}</span>
                </td>
                <td className="robot-price-cell">{formatPrice(asset.price, asset.quote)}</td>
                <td className={value >= 0 ? "positive robot-return-cell" : "negative robot-return-cell"}>{formatPct(value, 1)}</td>
                <td className="robot-spark-cell"><ChipSparkline asset={asset} range={range} /></td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}

function RobotChainPage({ language, setLanguage, t }) {
  const copy = robotChainCopy(t);
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState(null);
  const [robotState, setRobotState] = useState(readRobotChainStateFromHash);
  const { range } = robotState;

  useEffect(() => {
    const controller = new AbortController();
    fetch(appUrl("data/robot-chain-watchlist.json"), { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          const loadError = new Error("data-file");
          loadError.status = response.status;
          throw loadError;
        }
        return response.json();
      })
      .then((loadedDataset) => {
        setDataset(loadedDataset);
        setError(null);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError({ status: loadError.status, message: loadError.message });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      if (currentPage() !== "robotChain") return;
      setRobotState(readRobotChainStateFromHash());
    };
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    replaceHashState("robot-chain", robotState);
  }, [robotState]);

  const rows = useMemo(() => robotCategoryRows(dataset), [dataset]);
  const movers = useMemo(() => robotTopMovers(rows, range), [rows, range]);
  const rangeOptions = (dataset?.ranges || []).map((item) => ({ value: item.value, label: item.label }));

  if (error) {
    return <main className="status-page"><h1>{copy.unavailable}</h1><p>{error.status ? `${t.status.dataFileFailed} (${error.status})` : error.message}</p></main>;
  }
  if (!dataset) {
    return <main className="status-page"><p>{copy.loading}</p></main>;
  }

  return (
    <main className="app-page robot-chain-page">
      <header className="app-header">
        <div className="title-block">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1><span>{copy.titleAccent}</span> {copy.titleRest}</h1>
          <p>{copy.subtitle}</p>
          <PageNav page="robotChain" t={t} />
        </div>
        <div className="freshness-block">
          <LanguageToggle language={language} onChange={setLanguage} t={t} />
          <CacheStatus label={copy.cache} tooltip={copy.cacheTooltip} />
          <strong>{freshnessLabel(dataset.generatedAt, language)}</strong>
          <small>{dataset.failures?.length ? copy.failure(dataset.failures.length) : copy.success}</small>
        </div>
      </header>

      <ChainTreemapSummary movers={movers} range={range} copy={copy} className="robot-treemap-summary" />

      <section className="control-bar chip-chain-controls" aria-label={copy.controls}>
        <div className="control-primary">
          <Segmented label={copy.range} options={rangeOptions} value={range} onChange={(next) => setRobotState((current) => ({ ...current, range: next }))} />
        </div>
      </section>

      <section className="visualization robot-chain-section" aria-label={copy.tableTitle}>
        <div className="visualization-heading">
          <div>
            <p>{copy.tableKicker}</p>
            <h2>{copy.tableTitle}</h2>
          </div>
          <p className="method-note">{copy.tableMethod}</p>
        </div>
        <RobotChainTable rows={rows} range={range} language={language} copy={copy} />
      </section>

      <DataTrustFooter
        t={t}
        language={language}
        generatedAt={dataset.generatedAt}
        failures={dataset.failures}
        sources={[
          copy.sampleSource,
        ]}
        methodology={language === "zh" ? copy.tableMethod : dataset.methodology || copy.tableMethod}
        limitations={[
          copy.sourceNote,
          language === "en" ? dataset.sourceNoteEn : dataset.sourceNoteZh,
        ]}
      />
    </main>
  );
}

function currentPage() {
  if (typeof window === "undefined") return "crypto";
  const hashPath = window.location.hash.replace(/^#/, "");
  if (hashPath.startsWith("/robot-chain")) return "robotChain";
  if (hashPath.startsWith("/chip-chain")) return "chipChain";
  if (hashPath.startsWith("/market-clock")) return "marketClock";
  if (hashPath.startsWith("/macro-calendar")) return "macro";
  if (hashPath.startsWith("/equity-macro")) return "equity";
  if (hashPath.startsWith("/") || hashPath === "") return "crypto";
  if (routePathname(window.location.pathname).startsWith("/robot-chain")) return "robotChain";
  if (routePathname(window.location.pathname).startsWith("/chip-chain")) return "chipChain";
  if (routePathname(window.location.pathname).startsWith("/market-clock")) return "marketClock";
  if (routePathname(window.location.pathname).startsWith("/macro-calendar")) return "macro";
  return routePathname(window.location.pathname).startsWith("/equity-macro") ? "equity" : "crypto";
}

export function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [page, setPage] = useState(currentPage);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    const syncPage = () => setPage(currentPage());
    window.addEventListener("hashchange", syncPage);
    window.addEventListener("popstate", syncPage);
    return () => {
      window.removeEventListener("hashchange", syncPage);
      window.removeEventListener("popstate", syncPage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
    const marketClock = marketClockCopy(t);
    const chipChain = chipChainCopy(t);
    const robotChain = robotChainCopy(t);
    document.title = page === "robotChain" ? robotChain.docTitle : page === "chipChain" ? chipChain.docTitle : page === "marketClock" ? marketClock.docTitle : page === "macro" ? t.macroCalendar.docTitle : page === "equity" ? t.equity.docTitle : t.docTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", page === "robotChain" ? robotChain.docDescription : page === "chipChain" ? chipChain.docDescription : page === "marketClock" ? marketClock.docDescription : page === "macro" ? t.macroCalendar.docDescription : page === "equity" ? t.equity.docDescription : t.docDescription);
    try {
      window.localStorage.setItem("cycle-map-language", language);
    } catch {
      // Language persistence is nice to have, not required for the app to work.
    }
  }, [language, page, t]);

  if (page === "robotChain") return <RobotChainPage language={language} setLanguage={setLanguage} t={t} />;
  if (page === "chipChain") return <ChipChainPage language={language} setLanguage={setLanguage} t={t} />;
  if (page === "marketClock") return <MarketClockPage language={language} setLanguage={setLanguage} t={t} />;
  if (page === "macro") return <MacroCalendarPage language={language} setLanguage={setLanguage} t={t} />;
  if (page === "equity") return <EquityMacroPage language={language} setLanguage={setLanguage} t={t} />;
  return <CryptoCyclePage language={language} setLanguage={setLanguage} t={t} />;
}
