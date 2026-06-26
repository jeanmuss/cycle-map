import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ASSETS,
  HALVING_MONTHS,
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
      eyebrow: "RISK ASSET CYCLE MAP · UTC",
      titleAccent: "风险资产",
      titleRest: "周期与轮动图",
      subtitle: "按月观察 BTC、ETH、SOL、HYPE 的涨跌规律与轮动关系",
      cache: "本地缓存",
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
    },
    equity: {
      docTitle: "美股宏观轮动图",
      docDescription: "QQQ、SPY 周度收益与 FRED 宏观指标轮动可视化",
      eyebrow: "EQUITY MACRO MAP · WEEKLY",
      titleAccent: "美股宏观",
      titleRest: "轮动图",
      subtitle: "从特朗普第二任期开始，按周观察 QQQ、SPY、利率与波动率的联动",
      cache: "周度缓存",
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
      eyebrow: "RISK ASSET CYCLE MAP · UTC",
      titleAccent: "Risk Assets",
      titleRest: "Cycle & Rotation Map",
      subtitle: "Track monthly return patterns and rotation across BTC, ETH, SOL, and HYPE",
      cache: "Local cache",
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
    },
    equity: {
      docTitle: "Equity Macro Rotation Map",
      docDescription: "Weekly QQQ, SPY, and FRED macro rotation visualization",
      eyebrow: "EQUITY MACRO MAP · WEEKLY",
      titleAccent: "Equity Macro",
      titleRest: "Rotation Map",
      subtitle: "Track QQQ, SPY, rates, and volatility by week from Trump's second term",
      cache: "Weekly cache",
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

function PageNav({ page, t }) {
  return (
    <nav className="page-nav" aria-label="Page">
      <a className={page === "crypto" ? "is-active" : ""} aria-current={page === "crypto" ? "page" : undefined} href={appUrl()}>{t.nav.crypto}</a>
      <a className={page === "equity" ? "is-active" : ""} aria-current={page === "equity" ? "page" : undefined} href={appUrl("equity-macro")}>{t.nav.equity}</a>
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
    if (row) onSelect({ symbol, monthKey, row, value });
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
        const spotTime = formatUtcTimestamp(spot?.updatedAt);
        const note = [
          row.monthKey,
          row.isClosed ? null : t.latest.inMonth,
          spotTime ? `${t.latest.spotUpdated} ${spotTime}` : t.latest.spotUnavailable,
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
  const spotTime = formatUtcTimestamp(spot?.updatedAt);
  const note = [
    row.monthKey,
    row.isClosed ? null : t.latest.inMonth,
    spotTime ? `${t.latest.spotUpdated} ${spotTime}` : t.latest.spotUnavailable,
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

function formatUtcTimestamp(iso) {
  const timestamp = new Date(iso);
  if (Number.isNaN(timestamp.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
  return `${formatted} UTC`;
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
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("52");
  const [hover, setHover] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [selected, setSelected] = useState(null);

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

  const rows = useMemo(() => {
    const allRows = dataset?.weeks || [];
    return range === "all" ? [...allRows].reverse() : allRows.slice(-Number(range)).reverse();
  }, [dataset, range]);

  if (error) {
    return <main className="status-page"><h1>{t.equity.unavailable}</h1><p>{error.status ? `${t.status.dataFileFailed} (${error.status})` : error.message}</p></main>;
  }
  if (!dataset) {
    return <main className="status-page"><p>{t.equity.loading}</p></main>;
  }

  return (
    <main className="app-page equity-page">
      <header className="app-header">
        <div className="title-block">
          <p className="eyebrow">{t.equity.eyebrow}</p>
          <h1><span>{t.equity.titleAccent}</span> {t.equity.titleRest}</h1>
          <p>{t.equity.subtitle}</p>
        </div>
        <div className="freshness-block">
          <LanguageToggle language={language} onChange={setLanguage} t={t} />
          <PageNav page="equity" t={t} />
          <span className="cache-badge">{t.equity.cache}</span>
          <strong>{freshnessLabel(dataset.generatedAt, language)}</strong>
          <small>{dataset.failures?.length ? t.equity.failure(dataset.failures.length) : t.equity.success}</small>
        </div>
      </header>

      <EquitySummaryStrip dataset={dataset} t={t} />

      <section className="control-bar" aria-label={t.equity.controls}>
        <Segmented label={t.equity.range} options={t.equity.ranges} value={range} onChange={(next) => { setRange(next); setSelected(null); }} compact />
      </section>

      <section className="visualization" aria-label={t.equity.tableCaption}>
        <div className="visualization-heading">
          <div>
            <p>{t.equity.eyebrow}</p>
            <h2>{t.equity.visualTitle}</h2>
          </div>
          <p className="method-note">{t.equity.method}</p>
        </div>
        <EquityTable rows={rows} hover={hover} setHover={setHover} setTooltip={setTooltip} onSelect={setSelected} t={t} />
      </section>

      <EquityDetailBand selected={selected} dataset={dataset} t={t} />

      <footer className="source-footer">
        <div>
          <strong>{t.footer.title}</strong>
          <span>QQQ / SPY · {dataset.assets.QQQ.sourceLabel}</span>
          <span>FRED · DGS10 / VIXCLS / DFF</span>
          <span>{t.equity.eventPlaceholder}</span>
        </div>
        <p>{t.equity.priceSourceNote}</p>
      </footer>

      <EquityTooltip value={tooltip} t={t} />
    </main>
  );
}

function CryptoCyclePage({ language, setLanguage, t }) {
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState("rotation");
  const [metric, setMetric] = useState("absolute");
  const [range, setRange] = useState("48");
  const [asset, setAsset] = useState("BTC");
  const [hover, setHover] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [selected, setSelected] = useState(null);

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
    setView(next);
    setHover(null);
    setTooltip(null);
    setSelected(null);
  };

  const openAsset = (symbol) => {
    setAsset(symbol);
    setView("cycle");
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
    <main className={`app-page view-${view}`}>
      <header className="app-header">
        <div className="title-block">
          <p className="eyebrow">{t.header.eyebrow}</p>
          <h1><span>{t.header.titleAccent}</span> {t.header.titleRest}</h1>
          <p>{t.header.subtitle}</p>
        </div>
        <div className="freshness-block">
          <LanguageToggle language={language} onChange={setLanguage} t={t} />
          <PageNav page="crypto" t={t} />
          <span className="cache-badge">{t.header.cache}</span>
          <strong>{freshnessLabel(dataset.generatedAt, language)}</strong>
          <small>{dataset.failures?.length ? t.header.failure(dataset.failures.length) : t.header.success}</small>
        </div>
      </header>

      <LatestStrip dataset={dataset} onOpenAsset={openAsset} t={t} />

      <section className="control-bar" aria-label={t.controls.chart}>
        <Segmented label={t.controls.view} options={t.options.views} value={view} onChange={switchView} />
        <div className="control-spacer"></div>
        <Segmented label={t.controls.metric} options={t.options.metrics} value={metric} onChange={(next) => { setMetric(next); setSelected(null); }} compact />
        {view === "rotation" ? <Segmented label={t.controls.range} options={t.options.ranges} value={range} onChange={setRange} compact /> : null}
      </section>

      {view === "cycle" ? (
        <>
          <AssetSwitch value={asset} onChange={(next) => { setAsset(next); setSelected(null); }} t={t} />
          <AssetSpotSummary dataset={dataset} symbol={asset} t={t} />
        </>
      ) : null}

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
    </main>
  );
}

function currentPage() {
  if (typeof window === "undefined") return "crypto";
  return routePathname(window.location.pathname).startsWith("/equity-macro") ? "equity" : "crypto";
}

export function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const page = currentPage();
  const t = TRANSLATIONS[language];

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
    document.title = page === "equity" ? t.equity.docTitle : t.docTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", page === "equity" ? t.equity.docDescription : t.docDescription);
    try {
      window.localStorage.setItem("cycle-map-language", language);
    } catch {
      // Language persistence is nice to have, not required for the app to work.
    }
  }, [language, page, t]);

  return page === "equity"
    ? <EquityMacroPage language={language} setLanguage={setLanguage} t={t} />
    : <CryptoCyclePage language={language} setLanguage={setLanguage} t={t} />;
}
