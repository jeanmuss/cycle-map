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

const VALID_CRYPTO_VIEWS = new Set(["rotation", "cycle"]);
const VALID_CRYPTO_METRICS = new Set(["absolute", "relative"]);
const VALID_CRYPTO_RANGES = new Set(["12", "24", "48", "all"]);
const VALID_ASSETS = new Set(ASSETS.map((asset) => asset.symbol));
const VALID_EQUITY_RANGES = new Set(["26", "52", "all"]);
const VALID_MACRO_CATEGORIES = new Set(["all", "inflation", "growth", "rates", "volatility", "liquidity"]);
const VALID_CHIP_CHAIN_RANGES = new Set(["1d", "5d", "1m", "3m"]);

const EQUITY_MARKET_TEXT = {
  zh: {
    eyebrow: "EQUITY MARKET MAP",
    titleAccent: "\u7f8e\u80a1\u5e02\u573a",
    titleRest: "\u65e5\u5386",
    subtitle: "\u7528\u65e5\u9891\u4ef7\u683c\u3001\u5229\u7387\u548c\u6ce2\u52a8\u7387\u89c2\u5bdf\u98ce\u9669\u8d44\u4ea7\u7684\u77ed\u671f\u73af\u5883",
    cache: "\u5e02\u573a\u7f13\u5b58",
    cacheTooltip: "\u9875\u9762\u53ea\u8bfb\u53d6\u540e\u53f0\u751f\u6210\u7684\u9759\u6001\u7f13\u5b58\u3002\u5f00\u76d8\u671f\u53ef\u7531\u540e\u53f0\u6bcf\u5c0f\u65f6\u5237\u65b0\uff1b\u524d\u7aef\u4e0d\u76f4\u8fde\u884c\u60c5\u6e90\u3002",
    success: "\u5e02\u573a\u6570\u636e\u5df2\u66f4\u65b0",
    failure: (count) => `\u6570\u636e\u6e90\u5f02\u5e38\uff1a${count}`,
    loading: "\u6b63\u5728\u8bfb\u53d6\u672c\u5730\u5e02\u573a\u7f13\u5b58\u2026",
    unavailable: "\u7f8e\u80a1\u5e02\u573a\u6570\u636e\u672a\u80fd\u52a0\u8f7d",
    latest: "\u6700\u65b0\u89c2\u6d4b",
    dow: "DOW",
    tenYear: "10Y",
    vix: "VIX",
    open: "\u5f00",
    close: "\u6536",
    macro: "\u5229\u7387 / \u6ce2\u52a8",
    weekCalendarTitle: "\u672c\u5468\u8be6\u60c5",
    monthCalendarTitle: "\u6708\u5ea6\u6982\u89c8",
    currentWeek: "\u672c\u5468",
    currentMonth: "\u672c\u6708",
    previousWeek: "\u4e0a\u5468",
    nextWeek: "\u4e0b\u5468",
    previousMonth: "\u4e0a\u6708",
    nextMonth: "\u4e0b\u6708",
    priceSourceNote: "\u4ef7\u683c\u6765\u81ea AKShare/Sina \u7f8e\u80a1\u65e5\u7ebf\uff0cDOW \u4f7f\u7528 DIA ETF \u4ee3\u7406\uff1b10Y \u548c VIX \u6765\u81ea FRED\u3002\u524d\u7aef\u53ea\u8bfb\u53d6\u9759\u6001\u7f13\u5b58\u3002",
    eventPlaceholder: "\u672c\u9875\u6682\u4e0d\u63a5\u5165\u4e8b\u4ef6\u6ce8\u91ca\u3002",
  },
  en: {
    eyebrow: "EQUITY MARKET MAP",
    titleAccent: "Equity Market",
    titleRest: "Calendar",
    subtitle: "Daily price, rates, and volatility context for short-term risk-asset conditions.",
    cache: "Market cache",
    cacheTooltip: "The page reads a generated static cache. During market hours, backend jobs can refresh hourly; the frontend never connects directly to market-data providers.",
    success: "Market data updated",
    failure: (count) => `Source issues: ${count}`,
    loading: "Reading local market cache...",
    unavailable: "Equity market data could not be loaded",
    latest: "Latest observation",
    dow: "DOW",
    tenYear: "10Y",
    vix: "VIX",
    open: "Open",
    close: "Close",
    macro: "Rates / volatility",
    weekCalendarTitle: "This week details",
    monthCalendarTitle: "Monthly overview",
    currentWeek: "This week",
    currentMonth: "This month",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    previousMonth: "Previous",
    nextMonth: "Next",
    priceSourceNote: "Prices use AKShare/Sina U.S. daily data; DOW uses DIA as an ETF proxy. 10Y and VIX use FRED. The frontend reads static cache only.",
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
    status: {
      open: "盘中",
      trading: "交易中",
      premarket: "盘前",
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
    status: {
      open: "Open",
      trading: "Trading",
      premarket: "Pre-market",
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
    cache: "样例缓存",
    cacheTooltip: "当前页面读取的是本地样例缓存，用于验证信息架构和交互。正式版应由后端/CI 脚本读取经审查的行情源并生成静态 JSON；前端不直连行情源。",
    success: "样例产业链数据已加载",
    failure: (count) => `样例源提示：${count}`,
    loading: "正在读取产业链样例缓存…",
    unavailable: "AI 芯片产业链数据未能加载",
    controls: "产业链热点控制",
    range: "观察周期",
    latest: "当前热点",
    boardKicker: "CHAIN ROTATION BOARD",
    boardTitle: "产业链热力板",
    boardMethod: "类目涨幅为可见样例股票等权平均；颜色越深代表所选周期内越强。",
    detailEmptyTitle: "查看股票详情",
    detailEmptyBody: "点击任意股票代码，查看产业链角色、样例价格、各周期涨跌、相对强弱和计划信源。",
    selected: "已选股票",
    category: "所属模块",
    role: "产业链角色",
    price: "样例价格",
    returns: "涨跌幅",
    relative: "相对强弱",
    volume: "成交量放大",
    week52: "52 周位置",
    marketCap: "市值",
    source: "来源",
    sourceNote: "当前版本先用样例缓存展示页面结构，迷你 K 线也是按周期生成的样例走势；正式接入前需要完成数据授权、缓存频率、再展示条款、真实窗口价格序列和缺失数据策略确认。",
    sampleSource: "样例缓存",
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
    cache: "Sample cache",
    cacheTooltip: "This page reads a local sample cache to validate information architecture and interaction. Production should generate static JSON from backend/CI scripts using reviewed market-data feeds; the frontend must not call providers directly.",
    success: "Sample chip-chain data loaded",
    failure: (count) => `Sample source notes: ${count}`,
    loading: "Reading chip-chain sample cache...",
    unavailable: "AI chip-chain data could not be loaded",
    controls: "Chip-chain hotspot controls",
    range: "Window",
    latest: "Current hotspots",
    boardKicker: "CHAIN ROTATION BOARD",
    boardTitle: "Supply-chain heat board",
    boardMethod: "Category returns are equal-weighted from visible sample tickers. Deeper color means stronger performance in the selected window.",
    detailEmptyTitle: "Inspect a ticker",
    detailEmptyBody: "Select any ticker to see its role, sample price, multi-window returns, relative strength, and planned source.",
    selected: "Selected ticker",
    category: "Module",
    role: "Supply-chain role",
    price: "Sample price",
    returns: "Returns",
    relative: "Relative strength",
    volume: "Volume ratio",
    week52: "52-week position",
    marketCap: "Market cap",
    source: "Source",
    sourceNote: "This version uses a sample cache for page structure, and the mini price paths are generated sample paths by window. Before live data, confirm data licensing, cache cadence, redistribution rights, true window price series, and missing-data handling.",
    sampleSource: "Sample cache",
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
    },
    nav: {
      crypto: "加密周期",
      equity: "美股宏观",
      macro: "\u4e8b\u4ef6\u4e0e\u6d41\u52a8\u6027",
      marketClock: "开市轮动",
      chipChain: "芯片链热点",
    },
    equity: {
      docTitle: "美股宏观轮动图",
      docDescription: "QQQ、SPY 周度收益与 FRED 宏观指标轮动可视化",
      eyebrow: "EQUITY MACRO MAP · WEEKLY",
      titleAccent: "美股宏观",
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
      docTitle: "\u4e8b\u4ef6\u4e0e\u6d41\u52a8\u6027\u65e5\u5386",
      docDescription: "\u98ce\u9669\u8d44\u4ea7\u7684\u5b8f\u89c2\u3001\u5229\u7387\u3001\u7f8e\u5143\u3001\u6ce2\u52a8\u7387\u4e0e\u4fe1\u7528\u5229\u5dee\u89c2\u6d4b\u65e5\u5386",
      eyebrow: "EVENT & LIQUIDITY MAP",
      titleAccent: "\u4e8b\u4ef6\u4e0e\u6d41\u52a8\u6027",
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
      methodology: "\u89c2\u6d4b\u65e5\u4e0d\u7b49\u4e8e\u771f\u5b9e\u53d1\u5e03\u65f6\u95f4\uff1b\u9884\u6d4b\u503c\u6682\u7f3a\uff0c\u7b49\u540e\u7eed\u63a5\u5165\u7ecf\u5ba1\u67e5\u7684\u9884\u671f\u6216\u624b\u52a8\u4e8b\u4ef6\u6e90\u3002",
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
      week: "\u5468",
      twoYear: "2Y",
      tenYear: "10Y",
      realYield: "\u5b9e\u9645\u5229\u7387",
      dollar: "\u7f8e\u5143",
      vix: "VIX",
      credit: "\u4fe1\u7528",
      stress: "\u538b\u529b",
      noRows: "\u6682\u65e0\u5339\u914d\u6570\u636e",
      sourceNote: "\u5f53\u524d\u4ec5\u4f7f\u7528 FRED \u5b98\u65b9 API \u548c\u672c\u5730\u7f13\u5b58\uff1b\u672a\u4f7f\u7528 yfinance\uff0c\u4e5f\u672a\u63a5\u5165\u672a\u5ba1\u67e5\u7684\u9884\u6d4b\u6216\u65e5\u5386\u6765\u6e90\u3002",
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
      noData: "\u65e0\u6570\u636e",
      noIndicators: "\u5f53\u65e5\u65e0\u6307\u6807",
      clickDateHint: "\u70b9\u51fb\u65e5\u671f\u67e5\u770b\u8be6\u60c5",
      selectedDate: "\u5df2\u9009\u65e5\u671f",
      asOf: (date) => `\u622a\u81f3 ${date}`,
      periodNotice: "\u5f53\u524d\u4f7f\u7528 FRED \u89c2\u6d4b\u671f\u65e5\u671f\u505a\u6f14\u793a\uff0c\u4e0d\u628a\u5b83\u6807\u6ce8\u4e3a\u771f\u5b9e\u53d1\u5e03\u65f6\u95f4\u3002",
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
    },
    nav: {
      crypto: "Crypto cycle",
      equity: "Equity macro",
      macro: "Events & liquidity",
      marketClock: "Market clock",
      chipChain: "Chip chain",
    },
    equity: {
      docTitle: "Equity Macro Rotation Map",
      docDescription: "Weekly QQQ, SPY, and FRED macro rotation visualization",
      eyebrow: "EQUITY MACRO MAP · WEEKLY",
      titleAccent: "Equity Macro",
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
      docTitle: "Events & Liquidity Calendar",
      docDescription: "Macro, rates, dollar, volatility, and credit observations for risk assets",
      eyebrow: "EVENT & LIQUIDITY MAP",
      titleAccent: "Events & Liquidity",
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
      methodology: "Observation dates are not release timestamps. Forecasts remain N/A until a reviewed forecast source or manual backend input is added.",
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
      week: "Week",
      twoYear: "2Y",
      tenYear: "10Y",
      realYield: "Real yield",
      dollar: "Dollar",
      vix: "VIX",
      credit: "Credit",
      stress: "Stress",
      noRows: "No matching rows",
      sourceNote: "This version uses only the official FRED API plus local cache. It does not use yfinance or unreviewed forecast/calendar sources.",
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
      noData: "No data",
      noIndicators: "No indicators",
      clickDateHint: "Click a date for details",
      selectedDate: "Selected date",
      asOf: (date) => `as of ${date}`,
      periodNotice: "This demo uses FRED observation-period dates, not confirmed release timestamps.",
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

function PageNav({ page, t }) {
  return (
    <nav className="page-nav" aria-label="Page">
      <a className={page === "crypto" ? "is-active" : ""} aria-current={page === "crypto" ? "page" : undefined} href={appHashUrl()}>{t.nav.crypto}</a>
      <a className={page === "equity" ? "is-active" : ""} aria-current={page === "equity" ? "page" : undefined} href={appHashUrl("equity-macro")}>{t.nav.equity}</a>
      <a className={page === "macro" ? "is-active" : ""} aria-current={page === "macro" ? "page" : undefined} href={appHashUrl("macro-calendar")}>{t.nav.macro}</a>
      <a className={page === "marketClock" ? "is-active" : ""} aria-current={page === "marketClock" ? "page" : undefined} href={appHashUrl("market-clock")}>{t.nav.marketClock}</a>
      <a className={page === "chipChain" ? "is-active" : ""} aria-current={page === "chipChain" ? "page" : undefined} href={appHashUrl("chip-chain")}>{t.nav.chipChain}</a>
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

function addUtcDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function startOfSundayWeek(dateKey) {
  const date = utcDateFromKey(dateKey);
  return addUtcDays(date, -date.getUTCDay());
}

function weekDaysFor(dateKey) {
  const start = startOfSundayWeek(dateKey);
  const todayKey = dateKeyFromUtc(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = addUtcDays(start, index);
    const itemDateKey = dateKeyFromUtc(date);
    return { date, dateKey: itemDateKey, dayIndex: index, isToday: itemDateKey === todayKey };
  });
}

function monthKeyFromDateKey(dateKey) {
  return String(dateKey || "").slice(0, 7);
}

function monthGrid(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const start = startOfSundayWeek(dateKeyFromUtc(first));
  const days = [];
  for (let index = 0; index < 42; index += 1) {
    const date = addUtcDays(start, index);
    days.push({
      date,
      dateKey: dateKeyFromUtc(date),
      inMonth: date.getUTCMonth() === first.getUTCMonth(),
      isToday: dateKeyFromUtc(date) === dateKeyFromUtc(new Date()),
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

function compactIndicatorLabel(label) {
  const replacements = [
    ["Average hourly earnings", "AHE"],
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
    ["M2 money stock", "M2"],
  ];
  return replacements.reduce((value, [from, to]) => value.replace(from, to), label || "");
}

function eventWeekText(event) {
  return `${compactIndicatorLabel(event.label)} ${formatMacroValue(event.actual, event.unit)}`;
}

function eventMonthText(event) {
  return compactIndicatorLabel(event.label);
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
  if (daysToMonthEnd < 0 || daysToMonthEnd > 5) return [];
  const isQuarterEnd = [2, 5, 8, 11].includes(date.getUTCMonth());
  return [{
    type: "flow",
    date: dateKey,
    category: "liquidity",
    label: isQuarterEnd ? t.macroCalendar.quarterWindow : t.macroCalendar.monthWindow,
    text: isQuarterEnd ? t.macroCalendar.quarterWindow : t.macroCalendar.monthWindow,
  }];
}

function eventsByDate(events) {
  return events.reduce((map, event) => {
    const list = map.get(event.date) || [];
    list.push(event);
    map.set(event.date, list);
    return map;
  }, new Map());
}

function buildWeekCellItems(dateKey, category, eventMap, statusItems, t) {
  const eventItems = (eventMap.get(dateKey) || [])
    .filter((event) => event.category === category)
    .map((event) => ({ type: "event", category, event, text: eventWeekText(event) }));
  const stateItems = statusItems
    .filter((item) => item.date === dateKey && item.category === category)
    .map((item) => ({ ...item, text: item.text }));
  const flowItems = category === "liquidity" ? flowItemsForDate(dateKey, t) : [];
  return [...eventItems, ...stateItems, ...flowItems].slice(0, 4);
}

function buildWeekDayItems(dateKey, eventMap, statusItems, t) {
  const eventItems = (eventMap.get(dateKey) || []).map((event) => ({
    type: "event",
    category: event.category,
    event,
    text: eventWeekText(event),
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
    text: eventMonthText(event),
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
    text: eventMonthText(event),
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

function environmentSummary(week, t) {
  const values = week?.values || {};
  const tenYear = values.DGS10;
  const dollar = values.DTWEXBGS;
  const vix = values.VIXCLS;
  const credit = values.BAMLH0A0HYM2;
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
      { label: "10Y", value: formatMacroValue(tenYear?.end, tenYear?.unit), delta: environmentDeltaText(tenYear, t), className: macroMoveClass(tenYear?.changeBp) },
      { label: "DXY", value: formatMacroValue(dollar?.end, dollar?.unit), delta: environmentDeltaText(dollar, t, "pct"), className: dollar?.carriedForward ? "" : macroMoveClass(dollar?.pctChange) },
      { label: "VIX / HY", value: `${formatMacroValue(vix?.end, vix?.unit)} / ${formatMacroValue(credit?.end, credit?.unit)}`, delta: `${environmentDeltaText(vix, t)} / ${environmentDeltaText(credit, t)}`, className: macroMoveClass((Number(vix?.change) || 0) + (Number(credit?.changeBp) || 0)) },
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

function MacroWeekCalendar({ dataset, t }) {
  const [visibleWeekDate, setVisibleWeekDate] = useState(dataset.window.endDate);
  const eventMap = useMemo(() => eventsByDate(dataset.events || []), [dataset]);
  const days = useMemo(() => weekDaysFor(visibleWeekDate), [visibleWeekDate]);
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
  const eventMap = useMemo(() => eventsByDate(dataset.events || []), [dataset]);
  const days = useMemo(() => monthGrid(visibleMonth), [visibleMonth]);
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
                <strong>{day.dayOfMonth}</strong>
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
            <div className="macro-date-detail-item" key={`${item.event.seriesId}-${item.event.date}`}>
              <span className={`macro-pill macro-${item.category}`}>{macroCategoryLabel(item.category, t)}</span>
              <strong>{item.event.label}</strong>
              <dl>
                <div><dt>{t.macroCalendar.previous}</dt><dd>{formatMacroValue(item.event.previous, item.event.unit)}</dd></div>
                <div><dt>{t.macroCalendar.actual}</dt><dd>{formatMacroValue(item.event.actual, item.event.unit)}</dd></div>
                <div><dt>{t.macroCalendar.change}</dt><dd className={macroMoveClass(item.event.change)}>{formatMacroChange(item.event)}</dd></div>
                <div><dt>{t.macroCalendar.yoy}</dt><dd className={macroMoveClass(item.event.yoyPct)}>{isMacroNumber(item.event.yoyPct) ? formatPct(item.event.yoyPct, 2) : "N/A"}</dd></div>
              </dl>
              <small>{macroDateMeaningLabel(item.event.dateMeaning, t)} / {item.event.source}</small>
            </div>
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
              <small>{t.macroCalendar.periodNotice}</small>
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
          <span className="latest-return">{category.latestEventLabel || t.macroCalendar.noLatest}</span>
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
                  <strong>{event.label}</strong>
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
    return dataset.window.endDate;
  }, [dataset]);

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
      <MacroWeekCalendar dataset={dataset} t={t} />
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

      <footer className="source-footer">
        <div>
          <strong>{t.footer.title}</strong>
          <span>FRED</span>
          <span>{dataset.cache.providerCachePath}</span>
          <span>{dataset.sources.manualEvents}</span>
        </div>
        <p>{t.macroCalendar.sourceNote}</p>
      </footer>
    </main>
  );
}

const EQUITY_ASSET_KEYS = ["QQQ", "SPY", "DIA"];

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

function equityMoveClass(value) {
  if (!Number.isFinite(Number(value)) || Number(value) === 0) return "";
  return Number(value) > 0 ? "positive" : "negative";
}

function EquityMarketSummary({ dataset, t }) {
  const copy = equityCopy(t);
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
  const tenYear = latest.macro?.DGS10;
  const vix = latest.macro?.VIXCLS;
  return (
    <div className="latest-strip equity-strip" aria-label={copy.latest}>
      {cards.slice(0, 2).map((card) => (
        <div className="equity-summary-card" key={card.key}>
          <span className="ticker">{card.label}</span>
          <span className="latest-price">{card.value}</span>
          <span className={`latest-return ${card.className}`}>{card.delta}</span>
          <small>{card.note}</small>
        </div>
      ))}
      <div className="equity-summary-card" key={cards[2].key}>
        <span className="ticker">{cards[2].label}</span>
        <span className="latest-price">{cards[2].value}</span>
        <span className={`latest-return ${cards[2].className}`}>{cards[2].delta}</span>
        <small>{cards[2].note}</small>
      </div>
      <div className="equity-summary-card equity-macro-summary">
        <span className="ticker">{copy.macro}</span>
        <div className="equity-summary-lines">
          <span><b>{copy.tenYear}</b><strong>{formatEquityMacroValue(tenYear?.value, "percent")}</strong><em className={macroClass(tenYear?.changeBp)}>{formatEquityMacroChange("DGS10", tenYear)}</em></span>
          <span><b>{copy.vix}</b><strong>{formatEquityMacroValue(vix?.value, "index")}</strong><em className={macroClass(vix?.change)}>{formatEquityMacroChange("VIXCLS", vix)}</em></span>
        </div>
        <small>{latest.date || "N/A"}</small>
      </div>
    </div>
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
                  return (
                    <td key={day.dateKey} className={[hasData ? "" : "macro-calendar-empty", day.isToday ? "is-today" : ""].filter(Boolean).join(" ")}>
                      {hasData ? (
                        <div className="equity-day-detail">
                          {EQUITY_ASSET_KEYS.map((symbol) => {
                            const asset = row.assets?.[symbol];
                            return asset ? (
                              <span className="equity-day-row" key={symbol}>
                                <b>{equityAssetLabel(dataset, symbol, t)}</b>
                                <em>{copy.open} {formatEquityPrice(asset.open)}</em>
                                <em>{copy.close} {formatEquityPrice(asset.close)}</em>
                                <strong className={equityMoveClass(asset.pct)}>{formatPct(asset.pct, 2)}</strong>
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

function EquityMarketMonthCalendar({ dataset, visibleMonth, setVisibleMonth, language, t }) {
  const copy = equityCopy(t);
  const byDate = useMemo(() => equityDaysByDate(dataset), [dataset]);
  const days = useMemo(() => monthGrid(visibleMonth), [visibleMonth]);
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
            return (
              <div
                key={day.dateKey}
                className={[
                  "macro-month-day",
                  "equity-month-day",
                  day.inMonth ? "" : "is-muted",
                  day.isToday ? "is-today" : "",
                  hasData ? "has-items" : "",
                ].filter(Boolean).join(" ")}
              >
                <strong>{day.dayOfMonth}</strong>
                <span className="macro-month-items">
                  {hasData ? EQUITY_ASSET_KEYS.map((symbol) => {
                    const asset = row.assets?.[symbol];
                    return asset ? (
                      <small className={`macro-month-tag equity-month-tag ${equityMoveClass(asset.pct)}`} key={symbol}>
                        {equityAssetLabel(dataset, symbol, t)} {formatPct(asset.pct, 1)}
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
                  }) : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
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

  useEffect(() => {
    const controller = new AbortController();
    fetch(appUrl("data/equity-weekly.json"), { signal: controller.signal, cache: "no-store" })
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
    replaceHashState("equity-macro", {});
  }, []);

  useEffect(() => {
    if (!dataset) return;
    const latestDate = latestEquityDate(dataset);
    setVisibleWeekDate((current) => current || latestDate);
    setVisibleMonth((current) => current || monthKeyFromDateKey(latestDate));
  }, [dataset]);

  if (error) {
    return <main className="status-page"><h1>{copy.unavailable}</h1><p>{error.status ? `${t.status.dataFileFailed} (${error.status})` : error.message}</p></main>;
  }
  if (!dataset) {
    return <main className="status-page"><p>{copy.loading}</p></main>;
  }

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
          <strong>{freshnessLabel(dataset.generatedAt, language)}</strong>
          <small>{dataset.failures?.length ? copy.failure(dataset.failures.length) : copy.success}</small>
        </div>
      </header>

      <EquityMarketSummary dataset={dataset} t={t} />

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
          language={language}
          t={t}
        />
      ) : null}

      <footer className="source-footer">
        <div>
          <strong>{t.footer.title}</strong>
          <span>QQQ / SPY / DIA · {dataset.assets.QQQ.sourceLabel}</span>
          <span>FRED · DGS10 / VIXCLS</span>
          <span>{dataset.sources?.calendar}</span>
          <span>{copy.eventPlaceholder}</span>
        </div>
        <p>{copy.priceSourceNote}</p>
      </footer>

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

      <footer className="source-footer">
        <div>
          <strong>{t.footer.title}</strong>
          <span>OKX public market data</span>
          <span>CoinMarketCap market caps</span>
          <span>Session clocks computed locally</span>
        </div>
        <p>{dataset.methodology}</p>
      </footer>
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

      <footer className="source-footer">
        <div>
          <strong>{t.footer.title}</strong>
          <span>BTC · Blockchain.info / Binance Spot</span>
          <span>ETH / SOL · Binance Spot</span>
          <span>HYPE · Hyperliquid</span>
        </div>
      </footer>

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

function chipSparkValues(asset, range) {
  const returnPct = Number(asset?.returns?.[range]);
  const profiles = {
    "1d": { steps: 14, frequency: 2.2, pulse: 5.4, phase: 0.2, amplitude: 0.9, bend: -0.8 },
    "5d": { steps: 18, frequency: 3.6, pulse: 4.2, phase: 1.1, amplitude: 1.35, bend: 0.65 },
    "1m": { steps: 24, frequency: 5.1, pulse: 6.5, phase: 2.4, amplitude: 1.9, bend: 1.25 },
    "3m": { steps: 30, frequency: 4.4, pulse: 8.1, phase: 3.2, amplitude: 2.35, bend: -1.45 },
  };
  const profile = profiles[range] || profiles["1d"];
  const steps = profile.steps;
  const start = 100;
  const end = Number.isFinite(returnPct) ? 100 * (1 + returnPct / 100) : 100;
  const seed = String(asset?.symbol || "")
    .split("")
    .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 17);
  return Array.from({ length: steps }, (_, index) => {
    if (index === 0) return start;
    if (index === steps - 1) return end;
    const t = index / (steps - 1);
    const drift = start + (end - start) * t;
    const magnitude = Math.min(6, Math.abs(returnPct || 0) * 0.12);
    const wave = Math.sin((seed % 5 + profile.frequency) * Math.PI * t + profile.phase) * (profile.amplitude + magnitude);
    const pulse = Math.cos((seed % 7 + profile.pulse) * Math.PI * t + profile.phase / 2) * 0.7;
    const bend = Math.sin(Math.PI * t) * profile.bend * (returnPct >= 0 ? 1 : -1);
    return drift + wave + pulse + bend;
  });
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

function ChipHotspotSummary({ movers, range, selectedSymbol, onSelect, copy }) {
  return (
    <section className="chip-hotspot-summary" aria-label={copy.latest}>
      {movers.slice(0, 4).map((asset) => {
        const value = Number(asset.returns?.[range]);
        return (
          <button
            type="button"
            className={`chip-hotspot-card ${selectedSymbol === asset.symbol ? "is-selected" : ""}`}
            key={asset.symbol}
            onClick={() => onSelect(asset.symbol)}
          >
            <strong>{asset.symbol}</strong>
            <span>{asset.name}</span>
            <em className={value >= 0 ? "positive" : "negative"}>{formatPct(value, 1)}</em>
          </button>
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
        <strong>
          1D {formatPct(asset.returns?.["1d"], 1)} / 5D {formatPct(asset.returns?.["5d"], 1)} / 1M {formatPct(asset.returns?.["1m"], 1)}
        </strong>
      </div>
      <div>
        <small>{copy.relative}</small>
        <strong>{copy.vsSoxx} {formatPct(asset.relative?.soxx, 1)} / {copy.vsQqq} {formatPct(asset.relative?.qqq, 1)}</strong>
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

  useEffect(() => {
    if (!dataset) return;
    if (!movers.length) {
      setSelectedSymbol(null);
      return;
    }
    if (!selectedSymbol || !movers.some((asset) => asset.symbol === selectedSymbol)) {
      setSelectedSymbol(movers[0].symbol);
    }
  }, [dataset, movers, selectedSymbol]);

  if (error) {
    return <main className="status-page"><h1>{copy.unavailable}</h1><p>{error.status ? `${t.status.dataFileFailed} (${error.status})` : error.message}</p></main>;
  }
  if (!dataset) {
    return <main className="status-page"><p>{copy.loading}</p></main>;
  }

  return (
    <main className="app-page chip-chain-page">
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

      <ChipHotspotSummary movers={movers} range={range} selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} copy={copy} />

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
        <ChipChainBoard rows={rows} range={range} selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} language={language} copy={copy} />
      </section>

      <ChipChainDetail asset={selectedAsset} category={selectedCategory} copy={copy} language={language} />

      <footer className="source-footer">
        <div>
          <strong>{t.footer.title}</strong>
          <span>{plannedSourceLabel(language)}</span>
          <span>{copy.sampleSource}</span>
        </div>
        <p>{copy.sourceNote}</p>
      </footer>
    </main>
  );
}

function currentPage() {
  if (typeof window === "undefined") return "crypto";
  const hashPath = window.location.hash.replace(/^#/, "");
  if (hashPath.startsWith("/chip-chain")) return "chipChain";
  if (hashPath.startsWith("/market-clock")) return "marketClock";
  if (hashPath.startsWith("/macro-calendar")) return "macro";
  if (hashPath.startsWith("/equity-macro")) return "equity";
  if (hashPath.startsWith("/") || hashPath === "") return "crypto";
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
    document.title = page === "chipChain" ? chipChain.docTitle : page === "marketClock" ? marketClock.docTitle : page === "macro" ? t.macroCalendar.docTitle : page === "equity" ? t.equity.docTitle : t.docTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", page === "chipChain" ? chipChain.docDescription : page === "marketClock" ? marketClock.docDescription : page === "macro" ? t.macroCalendar.docDescription : page === "equity" ? t.equity.docDescription : t.docDescription);
    try {
      window.localStorage.setItem("cycle-map-language", language);
    } catch {
      // Language persistence is nice to have, not required for the app to work.
    }
  }, [language, page, t]);

  if (page === "chipChain") return <ChipChainPage language={language} setLanguage={setLanguage} t={t} />;
  if (page === "marketClock") return <MarketClockPage language={language} setLanguage={setLanguage} t={t} />;
  if (page === "macro") return <MacroCalendarPage language={language} setLanguage={setLanguage} t={t} />;
  if (page === "equity") return <EquityMacroPage language={language} setLanguage={setLanguage} t={t} />;
  return <CryptoCyclePage language={language} setLanguage={setLanguage} t={t} />;
}
