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
import { assetSessionStatus } from "../marketClockStatus.js";
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
import {
  MACRO_WEEK_ROWS,
  MACRO_STATUS_DISPLAY,
  MACRO_CATEGORY_ORDER,
  MONTH_CELL_ITEM_LIMIT,
  utcDateFromKey,
  dateKeyFromUtc,
  calendarTimeZone,
  dateKeyInTimeZone,
  localDateKey,
  localDateKeyForLanguage,
  useAutoLocalDateKey,
  addUtcDays,
  startOfSundayWeek,
  weekDaysFor,
  monthKeyFromDateKey,
  monthGrid,
  shiftMonth,
  monthTitle,
  dayLabel,
  sameOrBefore,
  findCurrentWeeklyState,
  findWeeklyStateForDate,
  macroEventLabel,
  compactIndicatorLabel,
  compactEventLabel,
  eventWeekText,
  eventMonthText,
  statusChipText,
  statusItemsForWeek,
  statusItemsForDate,
  flowItemsForDate,
  calendarDateKeyForEvent,
  eventsByDate,
  isHolidayEvent,
  holidayCountryCode,
  holidayCountryLabel,
  holidayCountryCodesForDate,
  buildWeekCellItems,
  buildWeekDayItems,
  statusGroupItemsForDate,
  monthItemWeight,
  limitMonthItems,
  buildMonthItems,
  buildMonthDetailItems,
  pressureSignal,
  environmentDeltaText,
  macroUsdBillions,
  formatMacroUsdLiquidity,
  netLiquidityCard,
  environmentSummary,
  MacroEnvironmentPanel,
  MacroWeekCalendar,
  MacroMonthCalendar,
  holidayDisplayName,
  holidayDateNote,
  MacroDateEventDetail,
  MacroDateDetails,
  MacroSummaryStrip,
  MacroEventsTable,
  MacroStateCell,
  MacroStateTable,
  MacroDetailBand,
  MacroCalendarPage,
} from "./MacroPage.jsx";

export const MARKET_CLOCK_MINUTES_PER_DAY = 24 * 60;
export const MARKET_CLOCK_DISPLAY_TIME_ZONES = {
  zh: "Asia/Shanghai",
  en: "America/New_York",
};

export function getInitialShowCrypto() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem("cycle-map-hide-crypto") !== "1";
  } catch {
    return true;
  }
}

export function minutesFromTime(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return (Number(hour) || 0) * 60 + (Number(minute) || 0);
}

export function timeFromMinutes(value) {
  const minutes = ((Math.round(Number(value) || 0) % MARKET_CLOCK_MINUTES_PER_DAY) + MARKET_CLOCK_MINUTES_PER_DAY) % MARKET_CLOCK_MINUTES_PER_DAY;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function localClockLabel(timeZone, language, now) {
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

export function marketDisplayTimeZone(language) {
  return language === "en" ? MARKET_CLOCK_DISPLAY_TIME_ZONES.en : MARKET_CLOCK_DISPLAY_TIME_ZONES.zh;
}

export function timeZoneOffsetMinutes(timeZone, date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return Math.round((localAsUtc - date.getTime()) / 60000);
}

export function displayMarketTime(value, marketTimeZone, language, now) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ""))) return "N/A";
  const displayZone = marketDisplayTimeZone(language);
  const shifted = minutesFromTime(value)
    + timeZoneOffsetMinutes(displayZone, now)
    - timeZoneOffsetMinutes(marketTimeZone, now);
  return timeFromMinutes(shifted);
}

export function displayMarketRange(start, end, marketTimeZone, language, now) {
  return `${displayMarketTime(start, marketTimeZone, language, now)}-${displayMarketTime(end, marketTimeZone, language, now)}`;
}

export function countdownLabel(totalMinutes, language) {
  if (!Number.isFinite(totalMinutes)) return "N/A";
  const minutes = Math.max(0, Math.round(totalMinutes));
  const days = Math.floor(minutes / MARKET_CLOCK_MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MARKET_CLOCK_MINUTES_PER_DAY) / 60);
  const mins = minutes % 60;
  if (language === "en") {
    return days ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;
  }
  return days ? `${days}天 ${hours}小时 ${mins}分` : `${hours}小时 ${mins}分`;
}

export function marketStatusCopy(key, copy) {
  const aliases = {
    "opening-auction": "openingAuction",
    "closing-auction": "closingAuction",
    "fixed-price-gap": "fixedPriceGap",
    "fixed-price": "fixedPrice",
  };
  return copy.status[aliases[key] || key] || copy.status.closed;
}

export function countdownToIso(value, now, language) {
  const target = Date.parse(value);
  if (!Number.isFinite(target)) return "N/A";
  return countdownLabel((target - now.getTime()) / 60000, language);
}

export function marketStatus(market, now, language, copy) {
  if (market.stateModel === "always_open") {
    return {
      key: "trading",
      label: copy.status.trading,
      active: true,
      sortRank: 0,
      localTime: copy.alwaysOpen,
      nextText: copy.alwaysOpen,
      nextTransitionAt: null,
      reason: null,
    };
  }

  const nowMs = now.getTime();
  const entry = (market.statusTimeline || []).find((item) => Date.parse(item.startAt) <= nowMs && nowMs < Date.parse(item.endAt));
  if (!entry) {
    return {
      key: "closed",
      label: copy.status.closed,
      active: false,
      sortRank: 4,
      localTime: localClockLabel(market.timezone, language, now),
      nextText: "N/A",
      nextTransitionAt: null,
      reason: language === "en" ? "Official calendar coverage unavailable" : "\u5b98\u65b9\u4ea4\u6613\u65e5\u5386\u8986\u76d6\u8303\u56f4\u5916",
    };
  }

  const nextTransitionAt = entry.nextTransitionAt || entry.endAt;
  return {
    key: entry.key,
    label: marketStatusCopy(entry.key, copy),
    active: Boolean(entry.active),
    sortRank: Number(entry.sortRank) || 4,
    localTime: localClockLabel(market.timezone, language, now),
    nextText: countdownToIso(nextTransitionAt, now, language),
    nextTransitionAt,
    reason: language === "en" ? entry.reason : entry.reasonZh || entry.reason,
  };
}

export function marketSessionWindows(market, copy, language, now) {
  const range = (start, end) => displayMarketRange(start, end, market.timezone, language, now);
  if (market.stateModel === "always_open") {
    return [{ key: "trading", label: copy.status.trading, time: copy.alwaysOpen }];
  }
  return (market.sessionTemplates || []).map((session, index) => ({
    key: session.key,
    reactKey: `${session.key}-${index}`,
    label: marketStatusCopy(session.key, copy),
    time: range(session.start, session.end),
  }));
}

export function marketDisplayName(market, language) {
  return language === "en" ? market.displayName : market.displayNameZh || market.displayName;
}

export function marketClockStatuses(dataset, now, language, copy) {
  return Object.fromEntries((dataset?.markets || []).map((market) => [market.id, marketStatus(market, now, language, copy)]));
}

export function marketClockRows(dataset, statuses, showCrypto, copy) {
  const marketOrder = new Map((dataset?.markets || []).map((market, index) => [market.id, index]));
  const markets = new Map((dataset?.markets || []).map((market) => [market.id, market]));
  return (dataset?.assets || [])
    .filter((asset) => showCrypto || asset.market !== "crypto")
    .map((asset) => ({
      asset,
      market: markets.get(asset.market),
      status: assetSessionStatus(
        asset,
        statuses[asset.market] || { key: "closed", label: "Closed", active: false, sortRank: 4 },
        copy?.status,
      ),
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

export function formatClockPrice(asset, copy) {
  if (asset?.price === null || asset?.price === undefined || asset?.price === "" || !Number.isFinite(Number(asset.price))) return copy.unavailableValue;
  const value = Number(asset.price);
  const digits = Math.abs(value) < 1 ? 4 : Math.abs(value) < 100 ? 2 : 2;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: value < 1 ? 4 : 0 }).format(value)} ${asset.quote}`;
}

export function formatMarketCapUsd(value, copy) {
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

export function marketCapLabel(asset, copy) {
  if (asset.marketCapStatus === "not_applicable") return copy.notApplicable;
  return formatMarketCapUsd(asset.marketCapUsd, copy);
}

export function assetDisplayName(asset, language) {
  return language === "en" ? asset.name : asset.nameZh || asset.name;
}

export function qualityLabel(asset, copy) {
  if (asset.sourceKind === "pending" || !Number.isFinite(Number(asset.price))) return copy.sourcePending;
  if (asset.sourceKind === "proxy") return "Proxy";
  return "OK";
}

export function qualityText(asset) {
  const notes = [];
  if (asset.quality) notes.push(asset.quality);
  if (asset.changeBasis) notes.push(`Change basis: ${asset.changeBasis}.`);
  if (asset.marketCapStatus === "unavailable") notes.push("Market cap unavailable from the current reviewed source.");
  if (asset.marketCapStatus === "not_applicable") notes.push("Market cap does not apply to this proxy/index instrument.");
  return notes.join(" ");
}

export function sourceTimeLabel(iso, language) {
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

export function MarketClockSummary({ dataset, statuses, language, copy, now }) {
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
            {status?.reason ? <small className="market-state-reason">{status.reason}</small> : null}
            <div className="market-session-strip" aria-label={`${marketDisplayName(market, language)} ${copy.sessions}`}>
              {marketSessionWindows(market, copy, language, now).map((session) => (
                <span className={`market-session-chip state-${session.key}`} key={`${market.id}-${session.reactKey || session.key}`}>
                  <b>{session.label}</b>
                  <i>{session.time}</i>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function MarketClockTable({ rows, selected, onSelect, language, copy }) {
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

export function MarketClockDetail({ selected, copy, language }) {
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

export function MarketClockTradingLimits({ copy }) {
  const tradingLimits = copy.tradingLimits;
  if (!tradingLimits?.markets?.length) return null;

  return (
    <section className="visualization market-limit-section" aria-label={tradingLimits.title}>
      <div className="visualization-heading market-limit-heading">
        <div>
          <p>{tradingLimits.kicker}</p>
          <h2>{tradingLimits.title}</h2>
          <p className="market-limit-intro">
            {(tradingLimits.introLines || [tradingLimits.note]).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
        </div>
      </div>
      <div className="market-limit-grid">
        {tradingLimits.markets.map((market) => (
          <article className="market-limit-market" key={market.market}>
            <header>
              <h3>{market.market}</h3>
              <p>{market.summary}</p>
            </header>
            <dl>
              {market.sessions.map(([label, limit]) => (
                <div key={`${market.market}-${label}`}>
                  <dt>{label}</dt>
                  <dd>{limit}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      <p className="market-limit-sources">
        <strong>{tradingLimits.sourcesLabel}</strong>
        <span>{tradingLimits.sources}</span>
      </p>
    </section>
  );
}

export function MarketClockPage({ language, setLanguage, t }) {
  const copy = useMemo(() => marketClockCopy(t), [t]);
  const { data: liveData, error, freshness: liveFreshness } = useLiveData(MARKET_CLOCK_LIVE_DATA);
  const dataset = liveData.marketSession;
  const freshnessItems = [buildFreshnessItem(language === "en" ? "Quotes / calendars" : "\u884c\u60c5 / \u4ea4\u6613\u65e5\u5386", liveFreshness.marketSession, dataset)];
  const [now, setNow] = useState(() => new Date());
  const [showCrypto, setShowCrypto] = useState(getInitialShowCrypto);
  const [selected, setSelected] = useState(null);

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
  const rows = useMemo(() => dataset ? marketClockRows(dataset, statuses, showCrypto, copy) : [], [dataset, statuses, showCrypto, copy]);

  useEffect(() => {
    setSelected((current) => {
      if (!current) return current;
      return rows.find((row) => row.asset.symbol === current.symbol && row.asset.market === current.market)?.asset || null;
    });
  }, [rows]);

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
          <DataFreshnessSummary items={freshnessItems} language={language} t={t} />
          <small>{dataset.failures?.length ? copy.failure(dataset.failures.length) : copy.success}</small>
        </div>
      </header>

      <MarketClockSummary dataset={dataset} statuses={statuses} language={language} copy={copy} now={now} />

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

      <MarketClockTradingLimits copy={copy} />

      <DataTrustFooter
        t={t}
        language={language}
        freshnessItems={freshnessItems}
        failures={dataset.failures}
        sources={[
          "OKX public market data",
          "CoinMarketCap market caps",
          "NYSE / KRX / SSE official calendars",
          copy.tradingLimits.sources,
        ]}
        methodology={copy.methodology || dataset.methodology}
        limitations={[copy.sourceNote, copy.tradingLimits.note]}
      />
    </main>
  );
}

export const marketClockMetadata = (t) => { const copy = marketClockCopy(t); return { title: copy.docTitle, description: copy.docDescription }; };
