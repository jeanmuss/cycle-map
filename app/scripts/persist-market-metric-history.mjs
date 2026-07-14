import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  dedupeMarketMetricRows,
  extractCryptoHistoryRows,
  extractJapanRateRows,
  selectIncrementalObservationRows,
} from "./market-metric-history-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(appRoot, "..");
const table = "market_metric_observations";
const batchSize = 500;
const requestTimeoutMs = 30_000;
const maxRequestAttempts = 3;

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function loadEnvFile(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function config() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bearer = key && !key.startsWith("sb_") ? `Bearer ${key}` : null;
  return { url, key, bearer };
}

function redact(value) {
  const { url, key } = config();
  let text = String(value || "");
  if (key) text = text.replaceAll(key, "<redacted>");
  if (url) text = text.replaceAll(url, "<supabase-url>");
  return text.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

async function request(path, options = {}) {
  const { url, key, bearer } = config();
  const requestBody = options.body == null ? undefined : JSON.stringify(options.body);
  let lastError = null;
  for (let attempt = 0; attempt < maxRequestAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response;
    try {
      response = await fetch(`${url}/rest/v1/${path}`, {
        method: options.method || "GET",
        signal: controller.signal,
        headers: {
          apikey: key,
          ...(bearer ? { Authorization: bearer } : {}),
          "Content-Type": "application/json",
          ...(options.prefer ? { Prefer: options.prefer } : {}),
        },
        body: requestBody,
      });
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (response) {
      const text = await response.text();
      if (response.ok) return text ? JSON.parse(text) : null;
      lastError = new Error(`Supabase market-history request failed (${response.status}): ${redact(text)}`);
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      if (!retryable) throw lastError;
    }

    if (attempt === maxRequestAttempts - 1) throw lastError;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500 * (2 ** attempt)));
  }
  throw lastError;
}

async function latestJapanObservation() {
  const query = [
    "select=observed_at",
    "metric_id=eq.macro.JGB10Y.value",
    "order=observed_at.desc",
    "limit=1",
  ].join("&");
  return (await request(`${table}?${query}`) || [])[0]?.observed_at || null;
}

async function upsertRows(rows) {
  for (let index = 0; index < rows.length; index += batchSize) {
    await request(`${table}?on_conflict=metric_id,observed_at,source_key`, {
      method: "POST",
      body: rows.slice(index, index + batchSize),
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
}

if (process.env.CYCLE_MAP_SKIP_LOCAL_ENV !== "1") {
  await loadEnvFile(resolve(appRoot, ".env.local"));
  await loadEnvFile(resolve(workspaceRoot, ".env.local"));
}

const { url, key } = config();
const historyRequired = process.env.CYCLE_MAP_REQUIRE_MARKET_HISTORY === "1";
if (!url || !key) {
  if (historyRequired) {
    throw new Error("Supabase market-history credentials are required in this environment");
  }
  console.log(JSON.stringify({ status: "skipped", reason: "Supabase market-history credentials are not configured" }));
  process.exit(0);
}

try {
  const [crypto, equity, jgbCache] = await Promise.all([
    readJson(resolve(appRoot, "public/data/crypto-liquidity.json"), {}),
    readJson(resolve(appRoot, "public/data/equity-weekly.json"), {}),
    readJson(resolve(workspaceRoot, "tmp/equity-cache/mof-JGB10Y.json"), null),
  ]);
  const latestJgb = await latestJapanObservation();
  const cryptoRows = extractCryptoHistoryRows(crypto);
  const japanRows = selectIncrementalObservationRows(
    extractJapanRateRows(jgbCache, equity),
    latestJgb,
    { initialBackfillDays: 400, overlapDays: 14 },
  );
  const rows = dedupeMarketMetricRows([...cryptoRows, ...japanRows]);
  if (!rows.length) throw new Error("No market metric observations were available to persist");
  await upsertRows(rows);
  console.log(JSON.stringify({ status: "persisted", rows: rows.length, cryptoRows: cryptoRows.length, japanRows: japanRows.length }));
} catch (error) {
  const detail = redact(error?.message || error);
  if (historyRequired) throw new Error(detail);
  console.warn(JSON.stringify({
    status: "skipped",
    reason: "Supabase market-history persistence is not ready",
    detail,
  }));
}
