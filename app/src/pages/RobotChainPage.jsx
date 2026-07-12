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
import {
  ChipSparkline,
  chipTreemapWeight,
  splitChipTreemapItems,
  chipTreemapTiles,
  chipTreemapSymbol,
  chipTreemapTextClass,
  ChainTreemapSummary,
  ChipTickerButton,
  ChipCategoryCard,
  ChipChainBoard,
  ChipChainDetail,
  ChipPendingWatchlist,
  ChipChainPage,
  robotAttributeLabel,
  robotCategoryRows,
  robotTopMovers,
} from "./ChipChainPage.jsx";
import { currentPage } from "../routeState.js";

export function RobotChainTable({ rows, range, language, copy }) {
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

export function RobotChainPage({ language, setLanguage, t }) {
  const copy = robotChainCopy(t);
  const { data: liveData, error, freshness: liveFreshness } = useLiveData(ROBOT_CHAIN_LIVE_DATA);
  const dataset = liveData.robotChain;
  const freshnessItems = [buildFreshnessItem(language === "en" ? "Robot-chain quotes" : "\u673a\u5668\u4eba\u94fe\u884c\u60c5", liveFreshness.robotChain, dataset)];
  const [robotState, setRobotState] = useState(readRobotChainStateFromHash);
  const { range } = robotState;

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
          <DataFreshnessSummary items={freshnessItems} language={language} t={t} />
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
        freshnessItems={freshnessItems}
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

export const robotChainMetadata = (t) => { const copy = robotChainCopy(t); return { title: copy.docTitle, description: copy.docDescription }; };
