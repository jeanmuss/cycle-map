import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(appRoot, "..");
const dataDir = resolve(appRoot, "public/data");
const outputPath = resolve(dataDir, "chart-series.json");
const macroFredCacheDir = resolve(workspaceRoot, "tmp/macro-cache/fred");

const WINDOWS = [
  { value: "1d", label: "1D", days: 1 },
  { value: "7d", label: "7D", days: 7 },
  { value: "1m", label: "1M", days: 31 },
  { value: "3m", label: "3M", days: 93 },
];

const TRANSFORMS = [
  { value: "raw", labelZh: "原值", labelEn: "Raw" },
  { value: "indexed", labelZh: "起点=100", labelEn: "Indexed" },
  { value: "changePct", labelZh: "区间涨跌幅", labelEn: "Change %" },
  { value: "zscore", labelZh: "标准化", labelEn: "Z-score" },
];

const CATEGORY_LABELS = {
  equity: { zh: "美股大盘", en: "U.S. market" },
  rates: { zh: "利率", en: "Rates" },
  inflation: { zh: "通胀", en: "Inflation" },
  growth: { zh: "增长", en: "Growth" },
  volatility: { zh: "波动", en: "Volatility" },
  liquidity: { zh: "流动性", en: "Liquidity" },
  chip_chain: { zh: "芯片链", en: "Chip chain" },
  robot_chain: { zh: "机器人链", en: "Robot chain" },
  other: { zh: "其他", en: "Other" },
};

function isoNow() {
  return new Date().toISOString();
}

function oldestIso(values) {
  return values
    .filter((value) => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0] || null;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactPoints(points) {
  const byTime = new Map();
  for (const point of points) {
    const value = finiteNumber(point?.v);
    const t = String(point?.t || "");
    if (!t || value == null || Number.isNaN(Date.parse(t))) continue;
    byTime.set(t, { t, v: value });
  }
  return [...byTime.values()].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
}

function addMetric(output, metric, rawPoints) {
  const points = compactPoints(rawPoints);
  if (points.length < 2) return;
  output.metrics[metric.id] = {
    precision: 2,
    defaultTransform: "raw",
    ...metric,
    categoryLabelZh: CATEGORY_LABELS[metric.category]?.zh || CATEGORY_LABELS.other.zh,
    categoryLabelEn: CATEGORY_LABELS[metric.category]?.en || CATEGORY_LABELS.other.en,
    first: points[0].t,
    last: points.at(-1).t,
    points: points.length,
  };
  output.series[metric.id] = points;
}

function macroEventObservations(macroDataset, seriesId) {
  return (macroDataset?.events || [])
    .filter((event) => event?.seriesId === seriesId && finiteNumber(event.actual) != null)
    .map((event) => ({ t: event.date, v: event.actual }));
}

function macroWeeklyStateObservations(macroDataset, seriesId) {
  return (macroDataset?.weeklyState || [])
    .map((week) => {
      const item = week.values?.[seriesId];
      return { t: item?.observationEnd || week.weekEnd || week.weekKey, v: item?.end };
    })
    .filter((point) => finiteNumber(point.v) != null);
}

function unitToUsdBillions(value, unit) {
  const number = finiteNumber(value);
  if (number == null) return null;
  if (unit === "usd_millions") return number / 1000;
  if (unit === "usd_billions" || unit === "usd_billions_chained") return number;
  return null;
}

function metricPointsInUsdBillions(output, metricId) {
  const metric = output.metrics[metricId];
  return (output.series[metricId] || [])
    .map((point) => ({ t: point.t, ms: Date.parse(point.t), v: unitToUsdBillions(point.v, metric?.unit) }))
    .filter((point) => point.t && Number.isFinite(point.ms) && point.v != null)
    .sort((a, b) => a.ms - b.ms);
}

function latestPointAtOrBefore(points, targetMs) {
  let latest = null;
  for (const point of points) {
    if (point.ms > targetMs) break;
    latest = point;
  }
  return latest;
}

function alignedLiquidityPoints(seriesByKey, anchorKey, deriveValue) {
  const anchors = seriesByKey[anchorKey] || [];
  return anchors
    .map((anchor) => {
      const values = Object.fromEntries(Object.entries(seriesByKey).map(([key, points]) => {
        const point = key === anchorKey ? anchor : latestPointAtOrBefore(points, anchor.ms);
        return [key, point?.v ?? null];
      }));
      const value = deriveValue(values);
      return { t: anchor.t, v: value };
    })
    .filter((point) => finiteNumber(point.v) != null);
}

function addDerivedLiquiditySeries(output) {
  const liquiditySeries = {
    fedAssets: metricPointsInUsdBillions(output, "macro.WALCL.value"),
    reserves: metricPointsInUsdBillions(output, "macro.WRESBAL.value"),
    tga: metricPointsInUsdBillions(output, "macro.WTREGEN.value"),
    rrp: metricPointsInUsdBillions(output, "macro.RRPONTSYD.value"),
  };
  if (!liquiditySeries.fedAssets.length) return;
  const derivedSource = "Derived from FRED WALCL / WRESBAL / WTREGEN / RRPONTSYD static caches";
  const derivedMetrics = [
    {
      metric: {
        id: "macro.NET_LIQUIDITY.value",
        labelZh: "净流动性 (Fed-TGA-RRP)",
        labelEn: "Net liquidity (Fed-TGA-RRP)",
        unit: "usd_billions",
        defaultTransform: "indexed",
      },
      value: ({ fedAssets, tga, rrp }) => [fedAssets, tga, rrp].every((item) => item != null) ? fedAssets - tga - rrp : null,
    },
    {
      metric: {
        id: "macro.FED_ASSETS_EX_TGA.value",
        labelZh: "Fed资产-TGA",
        labelEn: "Fed assets less TGA",
        unit: "usd_billions",
        defaultTransform: "indexed",
      },
      value: ({ fedAssets, tga }) => [fedAssets, tga].every((item) => item != null) ? fedAssets - tga : null,
    },
    {
      metric: {
        id: "macro.RESERVES_PLUS_RRP.value",
        labelZh: "储备+隔夜逆回购",
        labelEn: "Reserves + RRP",
        unit: "usd_billions",
        defaultTransform: "indexed",
      },
      value: ({ reserves, rrp }) => [reserves, rrp].every((item) => item != null) ? reserves + rrp : null,
    },
    {
      metric: {
        id: "macro.TGA_PLUS_RRP.value",
        labelZh: "TGA+隔夜逆回购",
        labelEn: "TGA + RRP drain",
        unit: "usd_billions",
        defaultTransform: "indexed",
      },
      value: ({ tga, rrp }) => [tga, rrp].every((item) => item != null) ? tga + rrp : null,
    },
    {
      metric: {
        id: "macro.RESERVES_SHARE_WALCL.value",
        labelZh: "储备/Fed资产",
        labelEn: "Reserves / Fed assets",
        unit: "percent",
        defaultTransform: "raw",
      },
      value: ({ reserves, fedAssets }) => [reserves, fedAssets].every((item) => item != null) && fedAssets !== 0 ? (reserves / fedAssets) * 100 : null,
    },
  ];

  for (const item of derivedMetrics) {
    addMetric(output, {
      category: "liquidity",
      kind: "derived_liquidity",
      cadence: "weekly",
      source: derivedSource,
      ...item.metric,
    }, alignedLiquidityPoints(liquiditySeries, "fedAssets", item.value));
  }
}

function addEquitySeries(output, equityDataset) {
  if (!equityDataset?.days?.length) return;
  const assets = ["QQQ", "SPY", "DIA", "SOX"];
  for (const symbol of assets) {
    const meta = equityDataset.assets?.[symbol] || {};
    const display = meta.displaySymbol || symbol;
    const source = meta.sourceLabel || "equity daily cache";
    const closePoints = equityDataset.days
      .map((day) => ({ t: day.date, v: day.assets?.[symbol]?.close ?? day.assets?.[symbol]?.price }))
      .filter((point) => finiteNumber(point.v) != null);
    addMetric(output, {
      id: `equity.${symbol}.close`,
      labelZh: `${display} 收盘价`,
      labelEn: `${display} close`,
      category: "equity",
      unit: meta.quote || "USD",
      kind: "price",
      cadence: "daily",
      source,
      defaultTransform: "indexed",
    }, closePoints);

    const returnPoints = equityDataset.days
      .map((day) => ({ t: day.date, v: day.assets?.[symbol]?.pct }))
      .filter((point) => finiteNumber(point.v) != null);
    addMetric(output, {
      id: `equity.${symbol}.return`,
      labelZh: `${display} 日涨跌幅`,
      labelEn: `${display} daily return`,
      category: "equity",
      unit: "percent",
      kind: "return",
      cadence: "daily",
      source,
      defaultTransform: "raw",
    }, returnPoints);
  }

  const macroSeries = equityDataset.macroSeries || {};
  for (const seriesId of Object.keys(macroSeries)) {
    const meta = macroSeries[seriesId] || {};
    const points = equityDataset.days
      .map((day) => ({ t: day.date, v: day.macro?.[seriesId]?.value }))
      .filter((point) => finiteNumber(point.v) != null);
    addMetric(output, {
      id: `macro.${seriesId}.value`,
      labelZh: meta.label || seriesId,
      labelEn: meta.label || seriesId,
      category: meta.kind === "volatility" ? "volatility" : "rates",
      unit: meta.unit || "number",
      kind: meta.kind || "macro",
      cadence: "daily",
      source: "FRED / equity daily cache",
      defaultTransform: seriesId === "VIXCLS" ? "indexed" : "raw",
    }, points);
  }
}

async function addMacroFredSeries(output, macroDataset) {
  const indicators = macroDataset?.indicators || {};
  for (const [seriesId, indicator] of Object.entries(indicators)) {
    const cache = await readJson(resolve(macroFredCacheDir, `${seriesId}.json`));
    const cacheObservations = Array.isArray(cache?.observations) ? cache.observations : [];
    const observations = [
      ...cacheObservations,
      ...macroEventObservations(macroDataset, seriesId),
      ...macroWeeklyStateObservations(macroDataset, seriesId),
    ];
    if (!observations.length) continue;
    const metricId = `macro.${seriesId}.value`;
    if ((output.series[metricId]?.length || 0) >= observations.length) continue;
    addMetric(output, {
      id: metricId,
      labelZh: indicator.label || seriesId,
      labelEn: indicator.label || seriesId,
      category: indicator.category || "other",
      unit: indicator.unit || "number",
      kind: indicator.role || "macro",
      cadence: indicator.cadence || "irregular",
      source: indicator.source || "FRED",
      dateMeaning: indicator.date_meaning || indicator.dateMeaning || "observation_date",
      defaultTransform: indicator.unit === "percent" ? "raw" : "indexed",
    }, observations.map((row) => ({ t: row.date || row.t, v: row.value ?? row.v })));
  }
}

function addChainSeries(output, dataset, chainKey, category) {
  if (!dataset?.assets) return;
  for (const asset of Object.values(dataset.assets)) {
    const paths = asset?.pricePaths || {};
    const rows = Object.values(paths).flatMap((path) => Array.isArray(path) ? path : []);
    const symbol = asset.symbol;
    if (!symbol || rows.length < 2) continue;
    const name = asset.name || asset.company || "";
    addMetric(output, {
      id: `chain.${chainKey}.${symbol}.price`,
      labelZh: name ? `${symbol} ${name}` : symbol,
      labelEn: name ? `${symbol} ${name}` : symbol,
      category,
      unit: asset.quote || "USD",
      kind: "price",
      cadence: "mixed",
      source: asset.sourceLabel || dataset.sourceNoteEn || `${chainKey} cache`,
      defaultTransform: "indexed",
    }, rows.map((row) => ({ t: row.t || row.date, v: row.c ?? row.close ?? row.price })));
  }
}

async function buildOutput() {
  const equityDataset = await readJson(resolve(dataDir, "equity-weekly.json"));
  const macroDataset = await readJson(resolve(dataDir, "macro-calendar.json"));
  const chipDataset = await readJson(resolve(dataDir, "chip-chain-hotspots.json"));
  const robotDataset = await readJson(resolve(dataDir, "robot-chain-watchlist.json"));
  const transformedAt = isoNow();
  const inputs = [equityDataset, macroDataset, chipDataset, robotDataset].filter(Boolean);
  const output = {
    version: 1,
    page: "chart-series",
    generatedAt: transformedAt,
    timestamps: {
      observedAt: oldestIso(inputs.map((dataset) => dataset.timestamps?.observedAt || dataset.generatedAt)),
      fetchedAt: oldestIso(inputs.map((dataset) => dataset.timestamps?.fetchedAt || dataset.generatedAt)),
      transformedAt,
    },
    windows: WINDOWS,
    transforms: TRANSFORMS,
    methodology: "Derived static time-series cache built from reviewed page caches and local/CI provider caches. The browser reads this generated JSON only and never calls market-data providers directly.",
    sources: {
      equity: "app/public/data/equity-weekly.json",
      macro: "tmp/macro-cache/fred plus app/public/data/macro-calendar.json metadata when available",
      chipChain: "app/public/data/chip-chain-hotspots.json pricePaths",
      robotChain: "app/public/data/robot-chain-watchlist.json pricePaths",
    },
    metrics: {},
    series: {},
  };

  addEquitySeries(output, equityDataset);
  await addMacroFredSeries(output, macroDataset);
  addDerivedLiquiditySeries(output);
  addChainSeries(output, chipDataset, "chip", "chip_chain");
  addChainSeries(output, robotDataset, "robot", "robot_chain");

  output.metricOrder = Object.values(output.metrics)
    .sort((a, b) => `${a.category}-${a.labelEn}`.localeCompare(`${b.category}-${b.labelEn}`))
    .map((metric) => metric.id);
  output.metricCount = output.metricOrder.length;
  return output;
}

const output = await buildOutput();
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "updated",
  outputPath,
  metrics: output.metricCount,
  generatedAt: output.generatedAt,
}, null, 2));
