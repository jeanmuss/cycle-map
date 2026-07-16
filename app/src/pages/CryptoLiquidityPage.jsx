import { useEffect, useMemo, useRef, useState } from "react";

import { freshnessLabel } from "../data.js";
import {
  cadenceDateAxis,
  calendarSpacedPoints,
  consecutivePeriodChanges,
  flowChartScale,
  metricHistoryByCadence,
  recentEtfFlowPoints,
  recentTreasuryDemandPoints,
} from "../cryptoLiquidityCharts.js";
import { useLiveData } from "../useLiveData.js";
import {
  buildFreshnessItem,
  CacheStatus,
  DataFreshnessSummary,
  DataTrustFooter,
  LanguageToggle,
  PageNav,
  replaceHashState,
  Segmented,
} from "./AppShared.jsx";

const CRYPTO_LIQUIDITY_LIVE_DATA = [
  { id: "cryptoLiquidity", path: "data/crypto-liquidity.json", pollIntervalMs: 300_000 },
];

const COPY = {
  zh: {
    docTitle: "\u52a0\u5bc6\u6d41\u52a8\u6027\u8109\u640f",
    docDescription: "ETF\u3001\u5e02\u503c\u4e0e\u7a33\u5b9a\u5e01\u4f9b\u5e94\u7684\u52a0\u5bc6\u5e02\u573a\u6d41\u52a8\u6027\u89c2\u5bdf",
    eyebrow: "CRYPTO LIQUIDITY PULSE",
    title: "\u52a0\u5bc6\u6d41\u52a8\u6027\u8109\u640f",
    subtitle: "\u533a\u5206 ETF \u8d44\u91d1\u6d41\u3001\u7a33\u5b9a\u5e01\u4f9b\u5e94\u4e0e\u4ef7\u683c\u9a71\u52a8\u7684\u5e02\u503c\u53d8\u5316",
    cache: "\u540e\u7aef\u9759\u6001\u5feb\u7167",
    cacheTooltip: "\u9875\u9762\u53ea\u8bfb\u53d6 CI \u751f\u6210\u7684\u9759\u6001 JSON\uff0cAPI Key \u4e0d\u8fdb\u5165\u6d4f\u89c8\u5668\u3002",
    loading: "\u6b63\u5728\u8bfb\u53d6\u52a0\u5bc6\u6d41\u52a8\u6027\u5feb\u7167\u2026",
    unavailable: "\u52a0\u5bc6\u6d41\u52a8\u6027\u6570\u636e\u6682\u4e0d\u53ef\u7528",
    range: "\u65f6\u95f4\u533a\u95f4", cadence: "\u89c2\u5bdf\u9891\u7387", daily: "\u65e5\u5ea6", weekly: "\u5468\u5ea6",
    breadth: "\u6d41\u52a8\u6027\u5e7f\u5ea6", expanding: "\u9879\u6307\u6807\u6269\u5f20", available: "\u6709\u53d8\u5316\u6570\u636e",
    levels: "\u5e02\u503c\u4e0e\u7a33\u5b9a\u5e01", change1d: "\u65e5\u53d8\u5316", change7d: "\u5468\u53d8\u5316", observed: "\u4fe1\u6e90\u89c2\u6d4b",
    heatmap: "\u53d8\u5316\u70ed\u529b\u5e26", heatmapNote: "\u5355\u5143\u683c\u663e\u793a\u76f8\u90bb\u89c2\u6d4b\u503c\u53d8\u5316\uff0c\u7a7a\u767d\u4e0d\u8865\u96f6\u3002",
    etf: "ETF \u8d44\u91d1\u6d41", latestFlow: "\u6700\u65b0\u51c0\u6d41\u91cf", cumulative: "\u7d2f\u8ba1\u51c0\u6d41\u91cf",
    treasury: "\u4f01\u4e1a\u8d22\u5e93\u9700\u6c42", treasuryNote: "\u6301\u4ed3\u4e0e\u6210\u672c\u6309\u5404\u81ea\u5b98\u65b9\u62ab\u9732\u65e5\u671f\u5c55\u793a\uff0c\u4e0d\u5c06\u65b0\u95fb\u7a3f\u5e02\u4ef7\u5f53\u4f5c\u91c7\u8d2d\u5747\u4ef7\u3002",
    holdings: "\u6700\u65b0\u6301\u4ed3", averageCost: "\u5e73\u5747\u6301\u4ed3\u6210\u672c", costBasisAverage: "SEC \u6210\u672c\u57fa\u7840\u5747\u4ef7",
    latestAcquisition: "\u6700\u65b0\u589e\u6301", spotVsCost: "\u73b0\u4ef7 / \u6210\u672c", holdingsDate: "\u6301\u4ed3\u622a\u81f3", costDate: "\u6210\u672c\u622a\u81f3",
    mixedDates: "\u4e0d\u540c\u62ab\u9732\u65e5\u671f", officialDisclosure: "\u5b98\u65b9\u62ab\u9732", disclosedDate: "\u62ab\u9732\u4e8e",
    pending: "\u5f85\u63a5\u5165\u5ba1\u6838\u540e\u6570\u636e\u6e90", noFlow: "\u5c1a\u65e0\u53ef\u7528 ETF \u6570\u636e",
    blockbeats: "BlockBeats \u8f85\u52a9\u6e90", primaryOnly: "\u9ed8\u8ba4\u5173\u95ed\uff0c\u4ec5\u7528\u4e8e BTC \u4ea4\u53c9\u68c0\u67e5\uff0c\u4e0d\u8986\u76d6\u4e3b\u6570\u636e\u3002",
    partial: "\u90e8\u5206\u6570\u636e\u5f85\u63a5\u5165", sourceTime: "\u6570\u636e\u65e5\u671f",
    recentFlow: "\u8fd1\u671f\u51c0\u6d41\u91cf", recentDemand: "\u8fd1\u671f\u6301\u4ed3\u589e\u51cf", observations: "\u4e2a\u89c2\u6d4b\u503c",
    missingFlow: "\u7070\u8272\u865a\u7ebf = \u89c2\u6d4b\u503c\u7f3a\u5931\uff1b\u7a7a\u6863 = \u8be5\u65e5\u671f\u65e0\u89c2\u6d4b", noObservation: "\u8be5\u65e5\u671f\u65e0\u89c2\u6d4b", tradingDays: "\u4e2a\u4ea4\u6613\u65e5", historyLkg: "\u8d8b\u52bf\u5386\u53f2\u6765\u81ea\u6570\u636e\u5e93\u6700\u8fd1\u53ef\u7528\u7f13\u5b58\uff1a{source}\uff1b\u4e0d\u8986\u76d6\u4e0a\u65b9\u5b98\u65b9\u5f53\u524d\u503c\u3002", insufficientTrend: "\u53ef\u7528\u89c2\u6d4b\u4e0d\u8db3 2 \u4e2a\uff0c\u6682\u4e0d\u80fd\u5224\u65ad\u8d8b\u52bf\u3002", disclosureCadence: "\u6309\u62ab\u9732\u65e5", noTreasuryHistory: "\u9009\u5b9a\u533a\u95f4\u6682\u65e0\u6301\u4ed3\u53d8\u52a8\u62ab\u9732",
  },
  en: {
    docTitle: "Crypto Liquidity Pulse", docDescription: "Crypto ETF flows, market-cap changes, and stablecoin supply signals",
    eyebrow: "CRYPTO LIQUIDITY PULSE", title: "Crypto Liquidity Pulse",
    subtitle: "Separate ETF capital flows and stablecoin supply from price-driven market-cap changes",
    cache: "Backend static snapshot", cacheTooltip: "The page reads only CI-generated static JSON; API keys never enter the browser.",
    loading: "Loading the crypto-liquidity snapshot…", unavailable: "Crypto-liquidity data is unavailable",
    range: "Time range", cadence: "Observation cadence", daily: "Daily", weekly: "Weekly",
    breadth: "Liquidity breadth", expanding: "indicators expanding", available: "with change data",
    levels: "Market cap & stablecoins", change1d: "1D change", change7d: "7D change", observed: "Source observation",
    heatmap: "Change heat strip", heatmapNote: "Cells show changes between adjacent observations; missing dates are not filled with zero.",
    etf: "ETF fund flows", latestFlow: "Latest net flow", cumulative: "Cumulative net flow",
    treasury: "Corporate treasury demand", treasuryNote: "Holdings and cost use their own official disclosure dates; press-release spot prices are never treated as acquisition cost.",
    holdings: "Latest holdings", averageCost: "Average holding cost", costBasisAverage: "SEC cost-basis average",
    latestAcquisition: "Latest addition", spotVsCost: "Spot vs cost", holdingsDate: "Holdings as of", costDate: "Cost as of",
    mixedDates: "Different disclosure dates", officialDisclosure: "Official disclosure", disclosedDate: "Disclosed",
    pending: "Pending reviewed source", noFlow: "No ETF flow data available yet",
    blockbeats: "BlockBeats auxiliary", primaryOnly: "Disabled by default; BTC cross-check only and never allowed to overwrite primary data.",
    partial: "Some sources are pending", sourceTime: "Data date",
    recentFlow: "Recent net flow", recentDemand: "Recent holdings change", observations: "observations",
    missingFlow: "Gray dash = missing value; blank = no observation that date", noObservation: "No observation on this date", tradingDays: "trading days", historyLkg: "Trend history uses the database last-known-good cache: {source}; it does not overwrite the official current value above.", insufficientTrend: "Fewer than 2 observations are available; no trend can be inferred yet.", disclosureCadence: "By disclosure date", noTreasuryHistory: "No holdings-change disclosure in the selected range",
  },
};

function usd(value, exact = false) {
  if (!Number.isFinite(value)) return "N/A";
  if (exact) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1e12) return `${sign}$${(absolute / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${sign}$${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${sign}$${(absolute / 1e6).toFixed(1)}M`;
  return `${sign}$${absolute.toFixed(0)}`;
}

function displayMetric(metric) {
  if (!Number.isFinite(metric?.value)) return "N/A";
  return metric.unit === "bps" ? `${metric.value >= 0 ? "+" : ""}${metric.value.toFixed(1)} bp` : usd(metric.value);
}

function displayChange(metric, field) {
  const value = metric?.[field];
  if (!Number.isFinite(value)) return "N/A";
  return metric.unit === "bps" ? `${value >= 0 ? "+" : ""}${value.toFixed(1)} bp` : `${value >= 0 ? "+" : ""}${usd(value)}`;
}

function signClass(value) {
  if (!Number.isFinite(value) || value === 0) return "is-flat";
  return value > 0 ? "is-positive" : "is-negative";
}

function compactAssetAmount(value, asset) {
  if (!Number.isFinite(value)) return "N/A";
  const amount = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return `${amount}${asset ? ` ${asset}` : ""}`;
}

function shortObservationDate(value) {
  return typeof value === "string" ? value.slice(0, 10) : "N/A";
}

function FlowBarChart({ copy, title, points, spacingCadence, rangeDays, windowEndDate, context, emptyMessage, formatValue, formatScale }) {
  const { finiteCount, maxAbsoluteValue } = flowChartScale(points);
  const renderedPoints = spacingCadence
    ? calendarSpacedPoints(points, spacingCadence, { rangeDays, windowEndDate })
    : points;
  const firstDate = points.find((point) => point.date)?.date;
  const lastDate = points.findLast((point) => point.date)?.date;
  const plotRef = useRef(null);

  useEffect(() => {
    const plot = plotRef.current;
    if (plot) plot.scrollLeft = plot.scrollWidth;
  }, [lastDate, renderedPoints.length, spacingCadence]);

  return (
    <figure className={`liquidity-flow-chart${points.length ? "" : " is-empty"}`}>
      <figcaption>
        <strong>{title}</strong>
        <span>{context}{points.length ? ` · ${finiteCount}/${points.length} ${copy.observations}` : ""}</span>
      </figcaption>
      {!points.length ? <p>{emptyMessage}</p> : (
        <>
          {finiteCount < 2 ? <p className="liquidity-flow-warning">{copy.insufficientTrend}</p> : null}
          <div className="liquidity-flow-plot-shell">
            <span className="liquidity-flow-axis is-high">{maxAbsoluteValue ? `+${formatScale(maxAbsoluteValue)}` : "0"}</span>
            <span className="liquidity-flow-axis is-zero">0</span>
            <span className="liquidity-flow-axis is-low">{maxAbsoluteValue ? `−${formatScale(maxAbsoluteValue)}` : "0"}</span>
            <div className="liquidity-flow-plot" ref={plotRef} role="region" aria-label={`${title}: ${context}`} tabIndex={0}>
              <ol style={{ "--flow-count": renderedPoints.length }}>
                {renderedPoints.map((point, index) => {
                  const value = point.value;
                  const magnitude = Number.isFinite(value) && maxAbsoluteValue
                    ? Math.abs(value) / maxAbsoluteValue
                    : 0;
                  const state = point.isGap
                    ? "is-gap"
                    : !Number.isFinite(value)
                    ? "is-missing"
                    : value > 0
                      ? "is-above-zero"
                      : value < 0
                        ? "is-below-zero"
                        : "is-on-zero";
                  const valueLabel = Number.isFinite(value) ? formatValue(value) : "N/A";
                  const dateLabel = point.date || "N/A";
                  const tradingDaysLabel = Number.isFinite(point.tradingDays)
                    ? ` · ${point.tradingDays} ${copy.tradingDays}`
                    : "";
                  return (
                    <li
                      className={state}
                      key={`${dateLabel}-${index}`}
                      style={{ "--flow-magnitude": magnitude }}
                      title={`${dateLabel}: ${point.isGap ? copy.noObservation : `${valueLabel}${tradingDaysLabel}`}`}
                      aria-hidden={point.isGap ? "true" : undefined}
                      aria-label={point.isGap ? undefined : `${dateLabel}: ${valueLabel}${tradingDaysLabel}`}
                      tabIndex={point.isGap ? undefined : 0}
                    >
                      <span className="liquidity-flow-bar" aria-hidden="true" />
                      <span className="sr-only">{dateLabel}: {valueLabel}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
          <footer>
            <span>{shortObservationDate(firstDate)}</span>
            <span>{copy.missingFlow}</span>
            <span>{shortObservationDate(lastDate)}</span>
          </footer>
        </>
      )}
    </figure>
  );
}

function HeatStrip({ metrics, history, days, cadence, windowEndDate, language, copy }) {
  const heatShellRef = useRef(null);
  const cadencedHistory = useMemo(
    () => metricHistoryByCadence(history, cadence, days, windowEndDate),
    [cadence, days, history, windowEndDate],
  );
  const dates = useMemo(
    () => cadenceDateAxis(cadence, days, windowEndDate),
    [cadence, days, windowEndDate],
  );
  useEffect(() => {
    const shell = heatShellRef.current;
    if (shell) shell.scrollLeft = shell.scrollWidth;
  }, [cadence, dates.length, days, windowEndDate]);
  if (!dates.length) return <p className="liquidity-empty">{copy.heatmapNote}</p>;
  return (
    <div className="liquidity-heat-shell" ref={heatShellRef} role="region" aria-label={copy.heatmap} tabIndex={0}><table className="liquidity-heat-table"><thead><tr><th scope="col">Metric</th>{dates.map((date) => <th scope="col" key={date}>{cadence === "weekly" ? `W${date.slice(5)}` : date.slice(5)}</th>)}</tr></thead><tbody>
      {metrics.map((metric) => {
        const changes = consecutivePeriodChanges(cadencedHistory[metric.id] || [], dates);
        return <tr key={metric.id}><th scope="row">{language === "en" ? metric.label : metric.labelZh}</th>{changes.map(({ date, point, change }) => {
          const detail = Number.isFinite(change) ? displayChange({ ...metric, change }, "change") : "N/A";
          return <td key={date} className={signClass(change)} title={`${point?.observedDate || date}: ${detail}`} aria-label={`${point?.observedDate || date}: ${detail}`}>{Number.isFinite(change) ? (change > 0 ? "+" : change < 0 ? "−" : "0") : "·"}</td>;
        })}</tr>;
      })}
    </tbody></table></div>
  );
}

function EtfCard({ asset, cadence, range, windowEndDate, copy }) {
  const sourcePoints = cadence === "weekly" ? asset?.weekly || [] : asset?.daily || [];
  const chartPoints = recentEtfFlowPoints(asset, cadence, Number(range), windowEndDate);
  const latest = sourcePoints.at(-1);
  const date = latest?.date || latest?.week;
  return (
    <article className="liquidity-etf-card">
      <header><strong>{asset?.asset || "N/A"}</strong><span>{asset?.status === "available" ? cadence.toUpperCase() : copy.pending}</span></header>
      <div><small>{copy.latestFlow}</small><b className={signClass(latest?.netFlowUsd)}>{usd(latest?.netFlowUsd)}</b></div>
      <div><small>{copy.cumulative}</small><b>{usd(latest?.cumulativeNetFlowUsd)}</b></div>
      <p>{date ? `${copy.sourceTime}: ${date}` : copy.noFlow}</p>
      <FlowBarChart
        copy={copy}
        title={copy.recentFlow}
        points={chartPoints}
        spacingCadence={cadence}
        rangeDays={Number(range)}
        windowEndDate={windowEndDate}
        context={`${range}D · ${cadence === "weekly" ? copy.weekly : copy.daily} · USD`}
        emptyMessage={copy.noFlow}
        formatValue={(value) => usd(value, true)}
        formatScale={(value) => usd(Math.abs(value))}
      />
    </article>
  );
}

function assetAmount(value, asset, signed = false) {
  if (!Number.isFinite(value)) return "N/A";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ${asset || ""}`.trim();
}

function percent(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function TreasuryCard({ treasury, range, windowEndDate, copy }) {
  const chartPoints = recentTreasuryDemandPoints(treasury, Number(range), windowEndDate);
  const costLabel = String(treasury?.averageCostMethod || "").startsWith("sec_")
    ? copy.costBasisAverage
    : copy.averageCost;
  return (
    <article className="liquidity-treasury-card">
      <header>
        <div><strong>{treasury?.company || "N/A"}</strong><span>{treasury?.ticker || ""}</span></div>
        <small>{copy.officialDisclosure}</small>
      </header>
      <div className="liquidity-treasury-hero">
        <small>{copy.holdings}</small>
        <strong>{assetAmount(treasury?.holdings, treasury?.asset)}</strong>
      </div>
      <dl>
        <div><dt>{costLabel}</dt><dd>{usd(treasury?.averageCostUsd, true)}</dd></div>
        <div><dt>{copy.latestAcquisition}</dt><dd className={signClass(treasury?.latestAcquisition)}>{assetAmount(treasury?.latestAcquisition, treasury?.asset, true)}</dd></div>
        <div><dt>{copy.spotVsCost}</dt><dd className={signClass(treasury?.costGapPct)}>{percent(treasury?.costGapPct)}</dd></div>
      </dl>
      <div className="liquidity-treasury-dates">
        <span><small>{copy.holdingsDate}</small><b>{treasury?.holdingsObservedAt?.slice(0, 10) || "N/A"}</b></span>
        <span><small>{copy.costDate}</small><b>{treasury?.costObservedAt?.slice(0, 10) || "N/A"}</b></span>
      </div>
      {treasury?.qualityStatus === "mixed_disclosure_dates" ? <p>{copy.mixedDates}</p> : null}
      {treasury?.historyQualityStatus === "database_last_known_good" && treasury?.historySource
        ? <p>{copy.historyLkg.replace("{source}", treasury.historySource)}</p>
        : null}
      <FlowBarChart
        copy={copy}
        title={copy.recentDemand}
        points={chartPoints}
        spacingCadence="daily"
        rangeDays={Number(range)}
        windowEndDate={windowEndDate}
        context={`${range}D · ${copy.disclosureCadence} · ${treasury?.asset || "N/A"}`}
        emptyMessage={copy.noTreasuryHistory}
        formatValue={(value) => assetAmount(value, treasury?.asset, true)}
        formatScale={(value) => compactAssetAmount(value, treasury?.asset)}
      />
    </article>
  );
}

export function CryptoLiquidityPage({ language, setLanguage, t }) {
  const copy = COPY[language];
  const { data, error, freshness } = useLiveData(CRYPTO_LIQUIDITY_LIVE_DATA);
  const dataset = data.cryptoLiquidity;
  const [range, setRange] = useState("30");
  const [cadence, setCadence] = useState("daily");

  useEffect(() => replaceHashState("crypto-liquidity", { range, cadence }), [cadence, range]);

  const metrics = dataset?.metrics || [];
  const breadth = metrics.filter((metric) => Number.isFinite(metric.change1d));
  const expanding = breadth.filter((metric) => metric.change1d > 0).length;
  const rangeWindowEnd = dataset?.generatedAt || dataset?.timestamps?.transformedAt || dataset?.timestamps?.observedAt;
  const freshnessItems = dataset ? [buildFreshnessItem(language === "en" ? "Crypto liquidity" : "\u52a0\u5bc6\u6d41\u52a8\u6027", freshness.cryptoLiquidity, dataset)] : [];

  if (error && !dataset) return <main className="status-page"><p>{copy.unavailable}</p><small>{error.message}</small></main>;
  if (!dataset) return <main className="status-page"><p>{copy.loading}</p></main>;

  return (
    <main className="app-page crypto-liquidity-page">
      <header className="app-header">
        <div className="title-block"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.subtitle}</p><PageNav page="cryptoLiquidity" t={t} /></div>
        <div className="freshness-block"><LanguageToggle language={language} onChange={setLanguage} t={t} /><CacheStatus label={copy.cache} tooltip={copy.cacheTooltip} /><strong className={dataset.status === "available" ? "macro-up" : "macro-flat"}>{dataset.status === "available" ? "LIVE" : copy.partial}</strong><small>{freshnessLabel(dataset.timestamps?.observedAt, language)}</small></div>
      </header>
      <DataFreshnessSummary items={freshnessItems} language={language} t={t} />

      <section className="liquidity-toolbar">
        <Segmented label={copy.range} value={range} onChange={setRange} options={[{ value: "30", label: "30D" }, { value: "90", label: "90D" }, { value: "365", label: "1Y" }]} compact />
        <Segmented label={copy.cadence} value={cadence} onChange={setCadence} options={[{ value: "daily", label: copy.daily }, { value: "weekly", label: copy.weekly }]} compact />
        <div className="liquidity-breadth"><small>{copy.breadth}</small><strong>{breadth.length ? `${expanding}/${breadth.length}` : "N/A"}</strong><span>{copy.expanding} · {breadth.length} {copy.available}</span></div>
      </section>

      <section className="liquidity-section"><div className="macro-section-heading"><div><p>LEVELS</p><h2>{copy.levels}</h2></div></div><div className="liquidity-metric-grid">{metrics.map((metric) => <article key={metric.id} className="liquidity-metric-card"><small>{language === "en" ? metric.label : metric.labelZh}</small><strong>{displayMetric(metric)}</strong><dl><div><dt>{copy.change1d}</dt><dd className={signClass(metric.change1d)}>{displayChange(metric, "change1d")}</dd></div><div><dt>{copy.change7d}</dt><dd className={signClass(metric.change7d)}>{displayChange(metric, "change7d")}</dd></div></dl><p>{copy.observed}: {metric.observedAt ? freshnessLabel(metric.observedAt, language) : "N/A"}</p></article>)}</div></section>

      <section className="liquidity-section"><div className="macro-section-heading"><div><p>ETF</p><h2>{copy.etf}</h2></div></div><div className="liquidity-etf-grid">{["BTC", "ETH", "SOL"].map((asset) => <EtfCard key={asset} asset={dataset.etf?.[asset]} cadence={cadence} range={range} windowEndDate={rangeWindowEnd} copy={copy} />)}</div></section>

      <section className="liquidity-section"><div className="macro-section-heading"><div><p>TREASURY</p><h2>{copy.treasury}</h2></div><span>{copy.treasuryNote}</span></div><div className="liquidity-treasury-grid">{["MSTR", "BMNR"].map((ticker) => <TreasuryCard key={ticker} treasury={dataset.corporateTreasuries?.[ticker]} range={range} windowEndDate={rangeWindowEnd} copy={copy} />)}</div></section>

      <section className="liquidity-section"><div className="macro-section-heading"><div><p>30 / 90 / 365D</p><h2>{copy.heatmap}</h2></div><span>{copy.heatmapNote}</span></div><HeatStrip metrics={metrics.filter((metric) => metric.unit === "USD")} history={dataset.history} days={Number(range)} cadence={cadence} windowEndDate={rangeWindowEnd} language={language} copy={copy} /></section>

      <section className="liquidity-auxiliary"><div><small>{copy.blockbeats}</small><strong>{dataset.auxiliarySources?.blockbeats?.status || "reserved_disabled"}</strong></div><p>{copy.primaryOnly}</p></section>

      <DataTrustFooter t={t} language={language} freshnessItems={freshnessItems} sources={Object.values(dataset.sources || {})} methodology={Object.values(dataset.methodology || {})} limitations={[copy.heatmapNote, dataset.methodology?.sol]} failures={dataset.failures || []} />
    </main>
  );
}

export const cryptoLiquidityMetadata = (t) => ({
  title: t.htmlLang === "en" ? COPY.en.docTitle : COPY.zh.docTitle,
  description: t.htmlLang === "en" ? COPY.en.docDescription : COPY.zh.docDescription,
});
