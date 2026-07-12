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
import { currentPage } from "../routeState.js";

export function CryptoCyclePage({ language, setLanguage, t }) {
  const { data: liveData, error, freshness: liveFreshness } = useLiveData(CRYPTO_LIVE_DATA);
  const dataset = liveData.marketMonthly;
  const freshnessItems = [buildFreshnessItem(language === "en" ? "Monthly market" : "\u6708\u5ea6\u884c\u60c5", liveFreshness.marketMonthly, dataset)];
  const [cryptoState, setCryptoState] = useState(readCryptoStateFromHash);
  const [hover, setHover] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [selected, setSelected] = useState(null);
  const { view, metric, range, asset } = cryptoState;

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
          <DataFreshnessSummary items={freshnessItems} language={language} t={t} />
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
        freshnessItems={freshnessItems}
        failures={dataset.failures}
        sources={[
          "BTC - Blockchain.info / Binance Spot",
          "ETH / SOL / BNB - Binance Spot",
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

export const cryptoMetadata = (t) => ({ title: t.docTitle, description: t.docDescription });
