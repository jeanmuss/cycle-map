import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(appRoot, "public", "data");
const outputPath = resolve(dataDirectory, "data-manifest.json");

const datasets = [
  { id: "marketMonthly", file: "market-monthly.json", pollIntervalMs: 300_000 },
  { id: "cryptoLiquidity", file: "crypto-liquidity.json", pollIntervalMs: 300_000 },
  { id: "macroCalendar", file: "macro-calendar.json", pollIntervalMs: 300_000 },
  { id: "equityWeekly", file: "equity-weekly.json", pollIntervalMs: 300_000 },
  { id: "equityFast", file: "equity-fast.json", pollIntervalMs: 60_000 },
  { id: "chartSeries", file: "chart-series.json", pollIntervalMs: 300_000 },
  { id: "marketSession", file: "market-session.json", pollIntervalMs: 300_000 },
  { id: "chipChain", file: "chip-chain-hotspots.json", pollIntervalMs: 300_000 },
  { id: "robotChain", file: "robot-chain-watchlist.json", pollIntervalMs: 300_000 },
];

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function latestTimestamp(values) {
  return values
    .map(validTimestamp)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
}

function inferObservedAt(datasetId, payload) {
  if (datasetId === "marketMonthly") {
    return latestTimestamp(Object.values(payload.assets || {}).flatMap((asset) => [
      asset.updatedAt,
      asset.spot?.updatedAt,
      ...(asset.rows || []).slice(-2).flatMap((row) => [row.closeTime, row.highTime, row.lowTime]),
    ]));
  }
  if (datasetId === "macroCalendar") {
    return latestTimestamp((payload.summary || []).map((item) => item.latestDate));
  }
  if (datasetId === "equityWeekly") {
    return latestTimestamp([
      payload.latest?.date,
      ...Object.values(payload.latest?.assets || {}).map((item) => item?.asOf),
    ]);
  }
  if (datasetId === "equityFast") {
    return latestTimestamp((payload.metrics || []).map((item) => item.asOf));
  }
  if (datasetId === "chartSeries") {
    return latestTimestamp(Object.values(payload.series || {}).flatMap((points) => (points || []).slice(-1).map((point) => point.t)));
  }
  if (datasetId === "marketSession") {
    return latestTimestamp((payload.assets || []).flatMap((asset) => [asset.asOf, asset.marketCapAsOf]));
  }
  if (datasetId === "chipChain" || datasetId === "robotChain") {
    return latestTimestamp(Object.values(payload.assets || {}).flatMap((asset) => [
      asset.asOf,
      ...Object.values(asset.pricePaths || {}).flatMap((points) => (points || []).slice(-1).map((point) => point.t)),
    ]));
  }
  return null;
}

async function describeDataset(definition) {
  const filePath = resolve(dataDirectory, definition.file);
  const source = await readFile(filePath);
  const payload = JSON.parse(source.toString("utf8"));
  const observedAt = validTimestamp(payload.timestamps?.observedAt) || inferObservedAt(definition.id, payload);
  const fetchedAt = validTimestamp(payload.timestamps?.fetchedAt) || validTimestamp(payload.fetchedAt) || validTimestamp(payload.generatedAt);
  const transformedAt = validTimestamp(payload.timestamps?.transformedAt) || validTimestamp(payload.generatedAt);

  return [
    definition.id,
    {
      path: `data/${definition.file}`,
      version: createHash("sha256").update(source).digest("hex"),
      observedAt,
      fetchedAt,
      transformedAt,
      timestampFallback: payload.timestamps ? null : "legacy-generatedAt",
      pollIntervalMs: definition.pollIntervalMs,
      sizeBytes: source.byteLength,
    },
  ];
}

await mkdir(dataDirectory, { recursive: true });
const entries = await Promise.all(datasets.map(describeDataset));
const deployedAt = new Date().toISOString();
const manifest = {
  version: 2,
  generatedAt: deployedAt,
  deployedAt,
  datasets: Object.fromEntries(entries.map(([id, entry]) => [id, { ...entry, deployedAt }])),
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath}`);
