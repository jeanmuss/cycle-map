import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  mergeCryptoLiquiditySnapshots,
  mergeMarketSessionSnapshots,
  selectFreshSnapshot,
  validateCryptoMergeResult,
  validateMarketSessionMergeResult,
  validatePassthroughSnapshot,
} from "./data-cache-merge-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const dataRoot = resolve(appRoot, "public", "data");
const DEFAULT_REF = "origin/data-cache";
const PASSTHROUGH_FILES = [
  "chart-series.json",
  "chip-chain-hotspots.json",
  "equity-fast.json",
  "equity-weekly.json",
  "macro-calendar.json",
  "market-monthly.json",
  "robot-chain-watchlist.json",
];
const SEMANTIC_FILES = new Map([
  ["crypto-liquidity.json", { merge: mergeCryptoLiquiditySnapshots, validate: validateCryptoMergeResult }],
  ["market-session.json", { merge: mergeMarketSessionSnapshots, validate: validateMarketSessionMergeResult }],
]);

function argumentValue(name, fallback) {
  const direct = process.argv.find((item) => item.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function validateRef(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value || "") || value.includes("..")) {
    throw new Error("Unsafe git ref; use a simple local or remote branch name");
  }
  return value;
}

function parseSnapshot(raw, label) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} is not a JSON object`);
  }
  return parsed;
}

function remoteSnapshot(ref, file) {
  const repoPath = `app/public/data/${file}`;
  const raw = execFileSync("git", ["show", `${ref}:${repoPath}`], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return { raw, parsed: parseSnapshot(raw, `${ref}:${repoPath}`) };
}

function removeIfPresent(path) {
  if (existsSync(path)) unlinkSync(path);
}

function atomicBatchWrite(entries) {
  const prepared = entries.map(({ path, content }, index) => ({
    path,
    content,
    tempPath: resolve(dirname(path), `.${basename(path)}.merge-${process.pid}-${index}.tmp`),
    backupPath: resolve(dirname(path), `.${basename(path)}.merge-${process.pid}-${index}.bak`),
    replaced: false,
    restored: false,
  }));
  let completed = false;
  try {
    // Prepare every candidate and rollback copy before replacing any target.
    for (const item of prepared) {
      writeFileSync(item.tempPath, item.content, "utf8");
      copyFileSync(item.path, item.backupPath);
    }
    for (const item of prepared) {
      renameSync(item.tempPath, item.path);
      item.replaced = true;
    }
    completed = true;
  } catch (error) {
    const rollbackErrors = [];
    for (const item of [...prepared].reverse()) {
      if (!item.replaced) continue;
      try {
        renameSync(item.backupPath, item.path);
        item.restored = true;
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], "Data-cache write failed and rollback backups were retained");
    }
    throw error;
  } finally {
    for (const item of prepared) {
      removeIfPresent(item.tempPath);
      if (completed || item.restored || !item.replaced) removeIfPresent(item.backupPath);
    }
  }
}

function serialized(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

const ref = validateRef(argumentValue("--ref", DEFAULT_REF));
const shouldWrite = process.argv.includes("--write");
const now = new Date().toISOString();
const summary = [];
const plannedWrites = [];

for (const file of PASSTHROUGH_FILES) {
  const localPath = resolve(dataRoot, file);
  const local = parseSnapshot(readFileSync(localPath, "utf8"), localPath);
  const remote = remoteSnapshot(ref, file);
  const result = selectFreshSnapshot(local, remote.parsed);
  if (result.selected === "remote") {
    validatePassthroughSnapshot(file, local, remote.parsed);
    plannedWrites.push({ path: localPath, content: remote.raw });
  }
  summary.push({
    file,
    strategy: "whole_snapshot_by_freshness",
    selected: result.selected,
    localFreshness: result.localFreshness,
    remoteFreshness: result.remoteFreshness,
  });
}

for (const [file, contract] of SEMANTIC_FILES) {
  const localPath = resolve(dataRoot, file);
  const local = parseSnapshot(readFileSync(localPath, "utf8"), localPath);
  const remote = remoteSnapshot(ref, file);
  const snapshot = contract.merge(local, remote.parsed, { now });
  contract.validate(local, remote.parsed, snapshot);
  plannedWrites.push({ path: localPath, content: serialized(snapshot) });
  summary.push({
    file,
    strategy: "field_level_contract",
    selected: "merged",
    localVersion: local.version ?? null,
    remoteVersion: remote.parsed.version ?? null,
  });
}

if (shouldWrite) atomicBatchWrite(plannedWrites);

console.log(JSON.stringify({
  status: shouldWrite ? "written" : "dry-run",
  ref,
  files: summary,
}, null, 2));
