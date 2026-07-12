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
import {
  FIVE_MINUTES_MS,
  MACRO_LIVE_DATA,
  EQUITY_SUMMARY_LIVE_DATA,
  EQUITY_CHART_LIVE_DATA,
  MARKET_CLOCK_LIVE_DATA,
  CRYPTO_LIVE_DATA,
  CHIP_CHAIN_LIVE_DATA,
  ROBOT_CHAIN_LIVE_DATA,
  useDeferredActivation,
  DEFAULT_CRYPTO_STATE,
  DEFAULT_EQUITY_STATE,
  DEFAULT_MACRO_STATE,
  DEFAULT_CHIP_CHAIN_STATE,
  DEFAULT_ROBOT_CHAIN_STATE,
  VALID_CRYPTO_VIEWS,
  VALID_CRYPTO_METRICS,
  VALID_CRYPTO_RANGES,
  VALID_ASSETS,
  VALID_EQUITY_RANGES,
  VALID_MACRO_CATEGORIES,
  VALID_CHIP_CHAIN_RANGES,
  VALID_ROBOT_CHAIN_RANGES,
  ADMIN_PAGE_ENABLED,
  MACRO_CALENDAR_TIME_ZONES,
  EQUITY_MARKET_TEXT,
  equityCopy,
  MARKET_CLOCK_TEXT,
  MARKET_CLOCK_LIMITS,
  marketClockCopy,
  CHIP_CHAIN_TEXT,
  chipChainCopy,
  ROBOT_CHAIN_TEXT,
  robotChainCopy,
  hashParams,
  readCryptoStateFromHash,
  readEquityStateFromHash,
  readMacroStateFromHash,
  readChipChainStateFromHash,
  readRobotChainStateFromHash,
  replaceHashState,
  optionLabel,
  TRANSLATIONS,
  getInitialLanguage,
  cycleLabel,
  extremeMoveMeta,
  Segmented,
  LanguageToggle,
  CacheStatus,
  textBlock,
  buildFreshnessItem,
  TimestampValue,
  DataFreshnessSummary,
  FreshnessAuditTable,
  DataTrustFooter,
  PageNav,
  AssetSwitch,
  yearBackground,
  HeatCell,
  TotalCell,
  LatestStrip,
  AssetSpotSummary,
  CryptoInsight,
  MobilePinnedDetail,
  RotationTable,
  CycleTable,
  DetailBand,
  Tooltip,
  Legend,
  formatNumber,
  formatSignedNumber,
  formatCompactPrice,
  formatBp,
  latestMacro,
  macroClass,
  isMacroNumber,
  macroMoveClass,
  macroCategoryLabel,
  compactMacroCategoryLabel,
  macroDateMeaningLabel,
  formatMacroValue,
  formatMacroChange,
} from "./AppShared.jsx";

export const MACRO_WEEK_ROWS = ["inflation", "growth", "rates", "volatility", "liquidity", "other"];

export const MACRO_STATUS_DISPLAY = {
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

export const MACRO_CATEGORY_ORDER = ["inflation", "growth", "rates", "volatility", "liquidity", "other"];
export const MONTH_CELL_ITEM_LIMIT = 3;

export function utcDateFromKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function dateKeyFromUtc(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function calendarTimeZone(language) {
  return MACRO_CALENDAR_TIME_ZONES[language] || MACRO_CALENDAR_TIME_ZONES.zh;
}

export function dateKeyInTimeZone(value, timeZone) {
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

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localDateKeyForLanguage(language, date = new Date()) {
  return dateKeyInTimeZone(date, calendarTimeZone(language)) || localDateKey(date);
}

export function useAutoLocalDateKey() {
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

export function addUtcDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function startOfSundayWeek(dateKey) {
  const date = utcDateFromKey(dateKey);
  return addUtcDays(date, -date.getUTCDay());
}

export function weekDaysFor(dateKey, language = "zh") {
  const start = startOfSundayWeek(dateKey);
  const todayKey = localDateKeyForLanguage(language);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addUtcDays(start, index);
    const itemDateKey = dateKeyFromUtc(date);
    return { date, dateKey: itemDateKey, dayIndex: index, isToday: itemDateKey === todayKey };
  });
}

export function monthKeyFromDateKey(dateKey) {
  return String(dateKey || "").slice(0, 7);
}

export function monthGrid(monthKey, language = "zh") {
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

export function shiftMonth(monthKey, delta) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKeyFromDateKey(dateKeyFromUtc(date));
}

export function monthTitle(monthKey, language) {
  const date = utcDateFromKey(`${monthKey}-01`);
  const locale = language === "en" ? "en-US" : "zh-CN";
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "long" }).format(date);
}

export function dayLabel(dateKey) {
  return String(dateKey).slice(5).replace("-", "/");
}

export function sameOrBefore(a, b) {
  return String(a) <= String(b);
}

export function findCurrentWeeklyState(dataset) {
  const endDate = dataset?.window?.endDate;
  const rows = dataset?.weeklyState || [];
  return rows.find((row) => row.weekStart <= endDate && row.weekEnd >= endDate)
    || [...rows].reverse().find((row) => sameOrBefore(row.weekEnd, endDate))
    || rows.at(-1)
    || null;
}

export function findWeeklyStateForDate(dataset, dateKey) {
  const rows = dataset?.weeklyState || [];
  return rows.find((row) => row.weekStart <= dateKey && row.weekEnd >= dateKey)
    || rows.find((row) => row.weekStart <= dateKey && row.weekEnd >= dateKeyFromUtc(addUtcDays(utcDateFromKey(dateKey), -1)))
    || null;
}

export function macroEventLabel(event, t) {
  if (!event) return "N/A";
  const localizedLabel = t.htmlLang === "zh-CN" ? event.labelZh : event.labelEn;
  if (localizedLabel) return localizedLabel;
  const labels = t.macroCalendar.eventLabels || {};
  const prefixes = t.macroCalendar.eventLabelPrefixes || {};
  const seriesId = String(event.seriesId || "");
  const bySeries = labels[seriesId];
  if (bySeries) return bySeries;
  const prefixMatch = Object.entries(prefixes).find(([prefix]) => seriesId.startsWith(prefix));
  if (prefixMatch) return prefixMatch[1];
  return labels[event.label] || event.label || "N/A";
}

export function compactIndicatorLabel(label, t) {
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

export function compactEventLabel(event, t) {
  const label = macroEventLabel(event, t);
  const compactLabel = t.macroCalendar.compactEventLabels?.[label];
  return compactLabel || compactIndicatorLabel(label, t);
}

export function eventWeekText(event, t) {
  return `${compactEventLabel(event, t)} ${formatMacroValue(event.actual, event.unit)}`;
}

export function eventMonthText(event, t) {
  return compactEventLabel(event, t);
}

export function statusChipText(seriesId, value) {
  const meta = MACRO_STATUS_DISPLAY[seriesId];
  if (!meta) return "";
  const changeText = meta.mode === "pct" && isMacroNumber(value.pctChange)
    ? formatPct(value.pctChange, 2)
    : formatMacroChange(value);
  return `${meta.label} ${changeText}`;
}

export function statusItemsForWeek(week) {
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

export function statusItemsForDate(dataset, dateKey) {
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

export function flowItemsForDate(dateKey, t) {
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

export function calendarDateKeyForEvent(event, language) {
  if (event?.releaseTimeUtc) {
    return dateKeyInTimeZone(event.releaseTimeUtc, calendarTimeZone(language)) || event.date;
  }
  return event?.date;
}

export function eventsByDate(events, language = "zh") {
  return events.reduce((map, event) => {
    const dateKey = calendarDateKeyForEvent(event, language);
    if (!dateKey) return map;
    const list = map.get(dateKey) || [];
    list.push(event);
    map.set(dateKey, list);
    return map;
  }, new Map());
}

export function isHolidayEvent(event) {
  return event?.role === "holiday";
}

export function holidayCountryCode(event) {
  const country = String(event?.country || "").toUpperCase();
  if (country) return country;
  const seriesId = String(event?.seriesId || "");
  if (seriesId.startsWith("US_FEDERAL_HOLIDAY")) return "US";
  if (seriesId.startsWith("CN_PUBLIC_HOLIDAY")) return "CN";
  return "";
}

export function holidayCountryLabel(countryCode, t) {
  return t.macroCalendar.countries?.[countryCode] || countryCode || "N/A";
}

export function holidayCountryCodesForDate(eventMap, dateKey) {
  return [...new Set((eventMap.get(dateKey) || [])
    .filter(isHolidayEvent)
    .map(holidayCountryCode)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

export function buildWeekCellItems(dateKey, category, eventMap, statusItems, t) {
  const eventItems = (eventMap.get(dateKey) || [])
    .filter((event) => event.category === category)
    .map((event) => ({ type: "event", category, event, displayDate: dateKey, text: eventWeekText(event, t) }));
  const stateItems = statusItems
    .filter((item) => item.date === dateKey && item.category === category)
    .map((item) => ({ ...item, text: item.text }));
  const flowItems = flowItemsForDate(dateKey, t).filter((item) => item.category === category);
  return [...eventItems, ...stateItems, ...flowItems].slice(0, 4);
}

export function buildWeekDayItems(dateKey, eventMap, statusItems, t) {
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

export function statusGroupItemsForDate(dataset, dateKey, t) {
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

export function monthItemWeight(item) {
  return item.type === "status-group" ? item.count : 1;
}

export function limitMonthItems(items, t) {
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

export function buildMonthItems(dateKey, dataset, eventMap, t) {
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

export function buildMonthDetailItems(dateKey, dataset, eventMap, t) {
  const eventItems = (eventMap.get(dateKey) || []).map((event) => ({
    type: "event",
    category: event.category,
    event,
    displayDate: dateKey,
    text: eventMonthText(event, t),
  }));
  return [...eventItems, ...statusItemsForDate(dataset, dateKey), ...flowItemsForDate(dateKey, t)];
}

export function pressureSignal(value, mode = "change") {
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

export function environmentDeltaText(item, t, mode = "change") {
  if (item?.carriedForward && item.observationEnd) return t.macroCalendar.asOf(dayLabel(item.observationEnd));
  if (mode === "pct" && isMacroNumber(item?.pctChange)) return formatPct(item.pctChange, 2);
  return formatMacroChange(item);
}

export function macroUsdBillions(item) {
  if (!isMacroNumber(item?.end)) return null;
  if (item.unit === "usd_millions") return Number(item.end) / 1000;
  if (item.unit === "usd_billions" || item.unit === "usd_billions_chained") return Number(item.end);
  return null;
}

export function formatMacroUsdLiquidity(value) {
  if (!isMacroNumber(value)) return "N/A";
  const billions = Number(value);
  if (Math.abs(billions) >= 1000) return `$${formatNumber(billions / 1000, 2)}T`;
  return `$${formatNumber(billions, 1)}B`;
}

export function netLiquidityCard(values, t) {
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

export function environmentSummary(week, t) {
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

export function MacroEnvironmentPanel({ dataset, t }) {
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

export function MacroWeekCalendar({ dataset, language, t }) {
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

export function MacroMonthCalendar({ dataset, selectedDate, setSelectedDate, visibleMonth, setVisibleMonth, language, t }) {
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

export function holidayDisplayName(event, t) {
  if (t.htmlLang === "zh-CN" && event?.holidayNameZh) return event.holidayNameZh;
  return event?.holidayName || macroEventLabel(event, t);
}

export function holidayDateNote(event, t) {
  const observedDate = event?.observedDate || event?.date;
  const legalDate = event?.legalDate || observedDate;
  if (!observedDate) return event?.note || "";
  if (legalDate && legalDate !== observedDate) {
    return t.macroCalendar.holidayObservedNote(observedDate, legalDate);
  }
  return t.macroCalendar.holidaySameDayNote(observedDate);
}

export function MacroDateEventDetail({ item, t }) {
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

export function MacroDateDetails({ dateKey, items, t }) {
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

export function MacroSummaryStrip({ dataset, t }) {
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

export function MacroEventsTable({ rows, selected, onSelect, t }) {
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

export function MacroStateCell({ row, id, mode = "change", t }) {
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

export function MacroStateTable({ rows, t }) {
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

export function MacroDetailBand({ selected, t }) {
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

export function MacroCalendarPage({ language, setLanguage, t }) {
  const { data: liveData, error, freshness: liveFreshness } = useLiveData(MACRO_LIVE_DATA);
  const dataset = liveData.macroCalendar;
  const freshnessItems = [buildFreshnessItem(language === "en" ? "Macro / FRED" : "\u5b8f\u89c2 / FRED", liveFreshness.macroCalendar, dataset)];
  const [selectedDate, setSelectedDate] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(null);

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
          <DataFreshnessSummary items={freshnessItems} language={language} t={t} />
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
        freshnessItems={freshnessItems}
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


export const macroMetadata = (t) => ({ title: t.macroCalendar.docTitle, description: t.macroCalendar.docDescription });
