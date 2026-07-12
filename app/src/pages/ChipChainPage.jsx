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
  plannedSourceLabel,
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

export function localizedField(item, field, language) {
  return item?.[`${field}${language === "en" ? "En" : "Zh"}`] || item?.[field] || "";
}

export function chipHeatClass(value) {
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

export function chipStageLabel(stage, copy) {
  return copy.stage?.[stage] || stage || "";
}

export function chipSourceLabel(asset, copy) {
  if (!asset) return "N/A";
  if (asset.sourceLabel) return asset.sourceLabel;
  return asset.sourceKind === "sample" ? copy.sampleSource : asset.sourceKind || "N/A";
}

export function formatMarketCap(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  if (n >= 1000) return `${formatNumber(n / 1000, 2)}T USD`;
  return `${formatNumber(n, n >= 10 ? 0 : 1)}B USD`;
}

export function formatWeek52Position(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  return `${Math.round(n * 100)}%`;
}

export function hasRealCachedPricePath(asset) {
  return !isChipSampleAsset(asset);
}

export function chipSparkValues(asset, range) {
  if (!hasRealCachedPricePath(asset)) return [];
  return (asset?.pricePaths?.[range] || [])
    .map((point) => Number(point?.c ?? point?.close ?? point?.price ?? point))
    .filter(Number.isFinite);
}

export function chipSparkGeometry(values, width = 94, height = 28) {
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

export function equityMoveClass(value) {
  if (!Number.isFinite(Number(value)) || Number(value) === 0) return "";
  return Number(value) > 0 ? "positive" : "negative";
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

export function ChipSparkline({ asset, range }) {
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

export function chipTreemapWeight(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.abs(numeric) + 0.25;
}

export function splitChipTreemapItems(items, rect) {
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

export function chipTreemapTiles(movers, range) {
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

export function chipTreemapSymbol(symbol) {
  return String(symbol || "").replace(/\.(KS|KQ)$/i, "");
}

export function chipTreemapTextClass(value) {
  const magnitude = Math.abs(Number(value));
  if (!Number.isFinite(magnitude)) return "chip-move-text-1";
  if (magnitude >= 7) return "chip-move-text-5";
  if (magnitude >= 4) return "chip-move-text-4";
  if (magnitude >= 2) return "chip-move-text-3";
  if (magnitude >= 0.8) return "chip-move-text-2";
  return "chip-move-text-1";
}

export function ChainTreemapSummary({ movers, range, selectedSymbol, onSelect, copy, className = "" }) {
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

export function ChipTickerButton({ asset, range, selected, onSelect, copy }) {
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

export function ChipCategoryCard({ row, range, selectedSymbol, onSelect, language, copy }) {
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

export function ChipChainBoard({ rows, range, selectedSymbol, onSelect, language, copy }) {
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

export function ChipChainDetail({ asset, category, copy, language }) {
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

export function ChipPendingWatchlist({ assets, categoryById, copy, language }) {
  if (!assets.length) return null;
  return (
    <section className="visualization chip-pending-section" data-testid="chip-pending-watchlist" aria-label={copy.pendingTitle}>
      <div className="visualization-heading">
        <div>
          <p>{copy.pendingKicker}</p>
          <h2>{copy.pendingTitle}</h2>
        </div>
        <p className="method-note">{copy.pendingDescription}</p>
      </div>
      <div className="chip-pending-grid">
        {assets.map((asset) => {
          const category = categoryById.get(asset.primaryCategory);
          return (
            <article className="chip-pending-card" key={asset.symbol}>
              <header>
                <div>
                  <strong>{asset.symbol}</strong>
                  <span>{asset.name}</span>
                </div>
                <small>{localizedField(category, "title", language) || asset.market?.toUpperCase() || "N/A"}</small>
              </header>
              <dl>
                <div><dt>{copy.pendingAsOf}</dt><dd>{sourceTimeLabel(asset.asOf, language)}</dd></div>
                <div><dt>{copy.pendingQuality}</dt><dd>{asset.dataQuality || chipSourceLabel(asset, copy)}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ChipChainPage({ language, setLanguage, t }) {
  const copy = chipChainCopy(t);
  const { data: liveData, error, freshness: liveFreshness } = useLiveData(CHIP_CHAIN_LIVE_DATA);
  const dataset = liveData.chipChain;
  const freshnessItems = [buildFreshnessItem(language === "en" ? "Chip-chain quotes" : "\u82af\u7247\u94fe\u884c\u60c5", liveFreshness.chipChain, dataset)];
  const [chipState, setChipState] = useState(readChipChainStateFromHash);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [selectionCleared, setSelectionCleared] = useState(false);
  const { range } = chipState;

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
  const pendingAssets = useMemo(() => chipPendingAssets(dataset), [dataset]);
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
          <DataFreshnessSummary items={freshnessItems} language={language} t={t} />
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
          <p className="method-note">{copy.rankingMethod}</p>
        </div>
        <ChipChainBoard rows={rows} range={range} selectedSymbol={selectedSymbol} onSelect={selectChipSymbol} language={language} copy={copy} />
      </section>

      <ChipPendingWatchlist assets={pendingAssets} categoryById={categoryById} copy={copy} language={language} />

      {selectedAsset ? <ChipChainDetail asset={selectedAsset} category={selectedCategory} copy={copy} language={language} /> : null}

      <DataTrustFooter
        t={t}
        language={language}
        freshnessItems={freshnessItems}
        failures={dataset.failures}
        sources={[
          plannedSourceLabel(language),
          copy.cacheSource || copy.sampleSource,
        ]}
        methodology={copy.rankingMethod}
        limitations={[copy.sourceNote, copy.pendingDescription]}
      />
    </main>
  );
}

export function robotAttributeLabel(attribute, copy) {
  return copy.attributeLabels?.[attribute] || attribute || "N/A";
}

export function robotCategoryRows(dataset) {
  const assetMap = dataset?.assets || {};
  return (dataset?.categories || []).map((category) => ({
    category,
    assets: (category.tickers || []).map((symbol) => assetMap[symbol]).filter(Boolean),
  })).filter((row) => row.assets.length);
}

export function robotTopMovers(rows, range) {
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


export const chipChainMetadata = (t) => { const copy = chipChainCopy(t); return { title: copy.docTitle, description: copy.docDescription }; };
