import { useEffect, useMemo, useState } from "react";

import { freshnessLabel } from "../data.js";
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
    range: "\u70ed\u529b\u533a\u95f4", cadence: "ETF \u9891\u7387", daily: "\u65e5\u5ea6", weekly: "\u5468\u5ea6",
    breadth: "\u6d41\u52a8\u6027\u5e7f\u5ea6", expanding: "\u9879\u6307\u6807\u6269\u5f20", available: "\u6709\u53d8\u5316\u6570\u636e",
    levels: "\u5e02\u503c\u4e0e\u7a33\u5b9a\u5e01", change1d: "\u65e5\u53d8\u5316", change7d: "\u5468\u53d8\u5316", observed: "\u4fe1\u6e90\u89c2\u6d4b",
    heatmap: "\u53d8\u5316\u70ed\u529b\u5e26", heatmapNote: "\u5355\u5143\u683c\u663e\u793a\u76f8\u90bb\u89c2\u6d4b\u503c\u53d8\u5316\uff0c\u7a7a\u767d\u4e0d\u8865\u96f6\u3002",
    etf: "ETF \u8d44\u91d1\u6d41", latestFlow: "\u6700\u65b0\u51c0\u6d41\u91cf", cumulative: "\u7d2f\u8ba1\u51c0\u6d41\u91cf",
    pending: "\u5f85\u63a5\u5165\u5ba1\u6838\u540e\u6570\u636e\u6e90", noFlow: "\u5c1a\u65e0\u53ef\u7528 ETF \u6570\u636e",
    blockbeats: "BlockBeats \u8f85\u52a9\u6e90", primaryOnly: "\u9ed8\u8ba4\u5173\u95ed\uff0c\u4ec5\u7528\u4e8e BTC \u4ea4\u53c9\u68c0\u67e5\uff0c\u4e0d\u8986\u76d6\u4e3b\u6570\u636e\u3002",
    partial: "\u90e8\u5206\u6570\u636e\u5f85\u63a5\u5165", sourceTime: "\u6570\u636e\u65e5\u671f",
  },
  en: {
    docTitle: "Crypto Liquidity Pulse", docDescription: "Crypto ETF flows, market-cap changes, and stablecoin supply signals",
    eyebrow: "CRYPTO LIQUIDITY PULSE", title: "Crypto Liquidity Pulse",
    subtitle: "Separate ETF capital flows and stablecoin supply from price-driven market-cap changes",
    cache: "Backend static snapshot", cacheTooltip: "The page reads only CI-generated static JSON; API keys never enter the browser.",
    loading: "Loading the crypto-liquidity snapshot…", unavailable: "Crypto-liquidity data is unavailable",
    range: "Heat range", cadence: "ETF cadence", daily: "Daily", weekly: "Weekly",
    breadth: "Liquidity breadth", expanding: "indicators expanding", available: "with change data",
    levels: "Market cap & stablecoins", change1d: "1D change", change7d: "7D change", observed: "Source observation",
    heatmap: "Change heat strip", heatmapNote: "Cells show changes between adjacent observations; missing dates are not filled with zero.",
    etf: "ETF fund flows", latestFlow: "Latest net flow", cumulative: "Cumulative net flow",
    pending: "Pending reviewed source", noFlow: "No ETF flow data available yet",
    blockbeats: "BlockBeats auxiliary", primaryOnly: "Disabled by default; BTC cross-check only and never allowed to overwrite primary data.",
    partial: "Some sources are pending", sourceTime: "Data date",
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

function HeatStrip({ metrics, history, days, language, copy }) {
  const dates = useMemo(() => {
    const all = new Set();
    Object.values(history || {}).forEach((points) => points.forEach((point) => all.add(point.date)));
    return [...all].sort().slice(-days);
  }, [days, history]);
  if (!dates.length) return <p className="liquidity-empty">{copy.heatmapNote}</p>;
  return (
    <div className="liquidity-heat-shell"><table className="liquidity-heat-table"><thead><tr><th scope="col">Metric</th>{dates.map((date) => <th scope="col" key={date}>{date.slice(5)}</th>)}</tr></thead><tbody>
      {metrics.map((metric) => {
        const points = Object.fromEntries((history?.[metric.id] || []).map((point) => [point.date, point.value]));
        let previous = null;
        return <tr key={metric.id}><th scope="row">{language === "en" ? metric.label : metric.labelZh}</th>{dates.map((date) => {
          const value = points[date];
          const change = Number.isFinite(value) && Number.isFinite(previous) ? value - previous : null;
          if (Number.isFinite(value)) previous = value;
          return <td key={date} className={signClass(change)} title={Number.isFinite(change) ? displayChange({ ...metric, change }, "change") : "N/A"}>{Number.isFinite(change) ? (change > 0 ? "+" : "−") : "·"}</td>;
        })}</tr>;
      })}
    </tbody></table></div>
  );
}

function EtfCard({ asset, cadence, copy }) {
  const points = cadence === "weekly" ? asset?.weekly || [] : asset?.daily || [];
  const latest = points.at(-1);
  const date = latest?.date || latest?.week;
  return (
    <article className="liquidity-etf-card">
      <header><strong>{asset?.asset || "N/A"}</strong><span>{asset?.status === "available" ? cadence.toUpperCase() : copy.pending}</span></header>
      <div><small>{copy.latestFlow}</small><b className={signClass(latest?.netFlowUsd)}>{usd(latest?.netFlowUsd)}</b></div>
      <div><small>{copy.cumulative}</small><b>{usd(latest?.cumulativeNetFlowUsd)}</b></div>
      <p>{date ? `${copy.sourceTime}: ${date}` : copy.noFlow}</p>
      <div className="liquidity-flow-strip" aria-label={`${asset?.asset || "ETF"} ${cadence}`}>{points.slice(-12).map((point) => <span key={point.date || point.week} className={signClass(point.netFlowUsd)} title={`${point.date || point.week}: ${usd(point.netFlowUsd, true)}`} />)}</div>
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

      <section className="liquidity-section"><div className="macro-section-heading"><div><p>ETF</p><h2>{copy.etf}</h2></div></div><div className="liquidity-etf-grid">{["BTC", "ETH", "SOL"].map((asset) => <EtfCard key={asset} asset={dataset.etf?.[asset]} cadence={cadence} copy={copy} />)}</div></section>

      <section className="liquidity-section"><div className="macro-section-heading"><div><p>30 / 90 / 365D</p><h2>{copy.heatmap}</h2></div><span>{copy.heatmapNote}</span></div><HeatStrip metrics={metrics.filter((metric) => metric.unit === "USD")} history={dataset.history} days={Number(range)} language={language} copy={copy} /></section>

      <section className="liquidity-auxiliary"><div><small>{copy.blockbeats}</small><strong>{dataset.auxiliarySources?.blockbeats?.status || "reserved_disabled"}</strong></div><p>{copy.primaryOnly}</p></section>

      <DataTrustFooter t={t} language={language} freshnessItems={freshnessItems} sources={Object.values(dataset.sources || {})} methodology={Object.values(dataset.methodology || {})} limitations={[copy.heatmapNote, dataset.methodology?.sol]} failures={dataset.failures || []} />
    </main>
  );
}

export const cryptoLiquidityMetadata = (t) => ({
  title: t.htmlLang === "en" ? COPY.en.docTitle : COPY.zh.docTitle,
  description: t.htmlLang === "en" ? COPY.en.docDescription : COPY.zh.docDescription,
});
