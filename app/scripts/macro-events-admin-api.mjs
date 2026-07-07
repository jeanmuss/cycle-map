import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFile, rename, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  hasSupabaseManualEventsConfig,
  manualEventsStoreMode,
  readManualEventsPayloadFromSupabase,
  writeManualEventsPayloadToSupabase,
} from "./manual-macro-events-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const manualEventsPath = resolve(appRoot, "data", "manual-macro-events.json");
const macroCalendarPath = resolve(appRoot, "public", "data", "macro-calendar.json");
const updateMacroCalendarScript = resolve(appRoot, "scripts", "update-macro-calendar.py");
const host = process.env.MACRO_EVENTS_ADMIN_HOST || "127.0.0.1";
const port = Number(process.env.MACRO_EVENTS_ADMIN_PORT || 5174);
const pythonCommand = process.env.CYCLE_MAP_PYTHON || "python";
const maxBodyBytes = 512 * 1024;
const execFileAsync = promisify(execFile);
const allowedOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5175",
  "http://localhost:5175",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const allowedCategories = new Set(["inflation", "growth", "rates", "volatility", "liquidity", "other"]);
const allowedStatuses = new Set(["published", "draft", "archived"]);

function jsonResponse(res, status, payload, origin = null) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
  });
  res.end(body);
}

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, PUT, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-cycle-map-admin",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function requestOrigin(req) {
  const origin = req.headers.origin;
  return typeof origin === "string" && allowedOrigins.has(origin) ? origin : null;
}

function requireAllowedOrigin(req, res) {
  const origin = requestOrigin(req);
  if (!origin) {
    jsonResponse(res, 403, { error: "origin_not_allowed" });
    return null;
  }
  return origin;
}

function requireAdminRequest(req, res) {
  const origin = requireAllowedOrigin(req, res);
  if (!origin) return null;
  if (req.headers["x-cycle-map-admin"] !== "1") {
    jsonResponse(res, 403, { error: "admin_header_required" }, origin);
    return null;
  }
  return origin;
}

function parseNumberOrNull(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeIso(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().replace(".000Z", "Z");
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function validateDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizeEvent(raw, index) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`events[${index}] must be an object`);
  }
  const category = normalizeText(raw.category || "liquidity");
  if (!allowedCategories.has(category)) throw new Error(`events[${index}].category is invalid`);
  const date = normalizeText(raw.date);
  if (!validateDateKey(date)) throw new Error(`events[${index}].date must be YYYY-MM-DD`);
  const seriesId = normalizeText(raw.seriesId);
  if (!/^[A-Z0-9_:-]{3,80}$/.test(seriesId)) throw new Error(`events[${index}].seriesId is invalid`);
  const status = normalizeText(raw.status || "published");
  if (!allowedStatuses.has(status)) throw new Error(`events[${index}].status is invalid`);
  const labelZh = normalizeText(raw.labelZh);
  const labelEn = normalizeText(raw.labelEn);
  const label = normalizeText(raw.label, [labelZh, labelEn].filter(Boolean).join(" / "));
  if (!label && !labelZh && !labelEn) throw new Error(`events[${index}] needs a label`);
  const source = normalizeText(raw.source);
  if (!source) throw new Error(`events[${index}].source is required`);
  const normalized = {
    status,
    date,
    seriesId,
    label,
    labelZh,
    labelEn,
    category,
    role: normalizeText(raw.role || "manual_liquidity_event"),
    cadence: normalizeText(raw.cadence || "event"),
    unit: normalizeText(raw.unit || "event"),
    source,
    dateMeaning: normalizeText(raw.dateMeaning || "scheduled_beijing_date"),
    actual: parseNumberOrNull(raw.actual),
    previous: parseNumberOrNull(raw.previous),
    forecast: parseNumberOrNull(raw.forecast),
    change: parseNumberOrNull(raw.change),
    changeBp: parseNumberOrNull(raw.changeBp),
    pctChange: parseNumberOrNull(raw.pctChange),
    yearAgo: parseNumberOrNull(raw.yearAgo),
    yoyPct: parseNumberOrNull(raw.yoyPct),
    note: normalizeText(raw.note),
  };
  const releaseTimeUtc = normalizeIso(raw.releaseTimeUtc || raw.releaseAtUtc);
  if (releaseTimeUtc) normalized.releaseTimeUtc = releaseTimeUtc;
  for (const key of ["sourceUrl", "country", "holidayName", "holidayNameZh", "observedDate", "legalDate", "referencePeriod"]) {
    const value = normalizeText(raw[key]);
    if (value) normalized[key] = value;
  }
  return normalized;
}

function normalizeEvents(events) {
  if (!Array.isArray(events)) throw new Error("manual macro events JSON must contain an events array");
  if (events.length > 300) throw new Error("Too many manual events");
  const normalized = events.map(normalizeEvent);
  const keys = new Set();
  for (const event of normalized) {
    const key = `${event.seriesId}::${event.date}`;
    if (keys.has(key)) throw new Error(`Duplicate manual event key: ${key}`);
    keys.add(key);
  }
  return normalized;
}

function normalizePayload(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  return {
    version: 1,
    updatedAt: isoNow(),
    events: normalizeEvents(events),
  };
}

async function readManualEvents() {
  if (hasSupabaseManualEventsConfig()) {
    const payload = await readManualEventsPayloadFromSupabase();
    await writeManualEventsFile(payload);
    return payload;
  }
  try {
    return JSON.parse(await readFile(manualEventsPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, updatedAt: null, events: [] };
    throw error;
  }
}

async function readMacroCalendar() {
  return JSON.parse(await readFile(macroCalendarPath, "utf8"));
}

function manualEventStatus(normalizedEvents, calendarPayload = null) {
  const published = normalizedEvents.filter((event) => event.status === "published");
  const draft = normalizedEvents.filter((event) => event.status === "draft");
  const archived = normalizedEvents.filter((event) => event.status === "archived");
  const calendarEvents = Array.isArray(calendarPayload?.events) ? calendarPayload.events : [];
  const calendarKeys = new Set(calendarEvents.map((event) => `${event.seriesId || ""}::${event.date || ""}`));
  const missingManualEvents = published
    .filter((event) => !calendarKeys.has(`${event.seriesId}::${event.date}`))
    .map((event) => ({
      date: event.date,
      seriesId: event.seriesId,
      label: event.label,
      labelZh: event.labelZh,
      labelEn: event.labelEn,
      category: event.category,
    }));
  return {
    ok: !missingManualEvents.length,
    manualEventCount: normalizedEvents.length,
    publishedManualEventCount: published.length,
    draftManualEventCount: draft.length,
    archivedManualEventCount: archived.length,
    macroCalendarGeneratedAt: calendarPayload?.generatedAt || null,
    macroCalendarEventCount: calendarEvents.length,
    missingManualEvents,
  };
}

async function macroCalendarStatus() {
  const manualPayload = await readManualEvents();
  const normalizedEvents = normalizeEvents(Array.isArray(manualPayload?.events) ? manualPayload.events : []);
  let calendarPayload = null;
  let calendarError = null;
  try {
    calendarPayload = await readMacroCalendar();
  } catch (error) {
    calendarError = error.message || "macro-calendar read failed";
  }
  const status = manualEventStatus(normalizedEvents, calendarPayload);
  return {
    ...status,
    ok: status.ok && !calendarError,
    manualEventsStore: manualEventsStoreMode(),
    manualEventsUpdatedAt: manualPayload?.updatedAt || null,
    calendarError,
  };
}

function macroPublishEnv() {
  return {
    ...process.env,
    MACRO_MANUAL_ONLY: "1",
    PYTHONIOENCODING: "utf-8",
  };
}

async function validateManualEvents() {
  const manualPayload = await readManualEvents();
  const normalizedEvents = normalizeEvents(Array.isArray(manualPayload?.events) ? manualPayload.events : []);
  const status = await macroCalendarStatus();
  return {
    ok: true,
    normalizedEventCount: normalizedEvents.length,
    status,
  };
}

function redactedText(text) {
  return String(text || "").replaceAll(appRoot, "<app>");
}

function publishOutput(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return {
      status: parsed.status || null,
      events: Number.isFinite(Number(parsed.events)) ? Number(parsed.events) : null,
    };
  } catch {
    return { text: redactedText(text) };
  }
}

async function publishMacroCalendar() {
  const validation = await validateManualEvents();
  const { stdout, stderr } = await execFileAsync(
    pythonCommand,
    [updateMacroCalendarScript],
    {
      cwd: appRoot,
      env: macroPublishEnv(),
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    },
  );
  return {
    ok: true,
    command: `${pythonCommand} scripts/update-macro-calendar.py`,
    output: publishOutput(stdout),
    stderr: redactedText(stderr.trim()),
    validation,
    status: await macroCalendarStatus(),
  };
}

async function readRequestBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function writeManualEventsFile(payload) {
  await mkdir(dirname(manualEventsPath), { recursive: true });
  const tempPath = `${manualEventsPath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, manualEventsPath);
}

async function writeManualEvents(payload) {
  if (!hasSupabaseManualEventsConfig()) {
    await writeManualEventsFile(payload);
    return payload;
  }
  await writeManualEventsPayloadToSupabase(payload);
  const savedPayload = await readManualEventsPayloadFromSupabase();
  await writeManualEventsFile(savedPayload);
  return savedPayload;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${host}:${port}`);
    if (req.method === "OPTIONS") {
      const origin = requireAllowedOrigin(req, res);
      if (!origin) return;
      res.writeHead(204, corsHeaders(origin));
      res.end();
      return;
    }
    if (url.pathname === "/health" && req.method === "GET") {
      jsonResponse(res, 200, { ok: true }, requestOrigin(req));
      return;
    }
    if (url.pathname === "/macro-calendar-status" && req.method === "GET") {
      jsonResponse(res, 200, await macroCalendarStatus(), requestOrigin(req));
      return;
    }
    if (url.pathname === "/validate-macro-events" && req.method === "POST") {
      const origin = requireAdminRequest(req, res);
      if (!origin) return;
      jsonResponse(res, 200, await validateManualEvents(), origin);
      return;
    }
    if (url.pathname === "/publish-macro-calendar" && req.method === "POST") {
      const origin = requireAdminRequest(req, res);
      if (!origin) return;
      jsonResponse(res, 200, await publishMacroCalendar(), origin);
      return;
    }
    if (url.pathname !== "/manual-macro-events") {
      jsonResponse(res, 404, { error: "not_found" }, requestOrigin(req));
      return;
    }
    if (req.method === "GET") {
      jsonResponse(res, 200, await readManualEvents(), requestOrigin(req));
      return;
    }
    if (req.method === "PUT") {
      const origin = requireAdminRequest(req, res);
      if (!origin) return;
      const payload = normalizePayload(JSON.parse(await readRequestBody(req)));
      const savedPayload = await writeManualEvents(payload);
      jsonResponse(res, 200, savedPayload, origin);
      return;
    }
    jsonResponse(res, 405, { error: "method_not_allowed" }, requestOrigin(req));
  } catch (error) {
    jsonResponse(res, 400, { error: error.message || "bad_request" }, requestOrigin(req));
  }
});

server.listen(port, host, () => {
  console.log(`Macro events admin API listening at http://${host}:${port}`);
  console.log(`Manual events store: ${manualEventsStoreMode()}`);
  console.log(`Manual events cache file: ${manualEventsPath}`);
});
