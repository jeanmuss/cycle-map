const SUPABASE_TABLE = "manual_macro_events";
const SERVICE_KEY_ENV_NAMES = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

const NUMERIC_FIELDS = [
  ["actual", "actual"],
  ["previous", "previous"],
  ["forecast", "forecast"],
  ["change", "change"],
  ["changeBp", "change_bp"],
  ["pctChange", "pct_change"],
  ["yearAgo", "year_ago"],
  ["yoyPct", "yoy_pct"],
];

const TEXT_FIELDS = [
  ["sourceUrl", "source_url"],
  ["dateMeaning", "date_meaning"],
  ["releaseTimeUtc", "release_time_utc"],
];

const CORE_EVENT_KEYS = new Set([
  "status",
  "date",
  "seriesId",
  "label",
  "labelZh",
  "labelEn",
  "category",
  "role",
  "cadence",
  "unit",
  "source",
  "sourceUrl",
  "dateMeaning",
  "releaseTimeUtc",
  "actual",
  "previous",
  "forecast",
  "change",
  "changeBp",
  "pctChange",
  "yearAgo",
  "yoyPct",
  "note",
  "metadata",
]);

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function nullableText(value) {
  const text = cleanText(value);
  return text ? text : null;
}

function nullableNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeUtc(value) {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString().replace(".000Z", "Z");
}

function serviceKey() {
  for (const name of SERVICE_KEY_ENV_NAMES) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

function supabaseConfig() {
  const url = cleanText(process.env.SUPABASE_URL).replace(/\/+$/, "");
  const key = serviceKey();
  const bearer = key && !key.startsWith("sb_") ? `Bearer ${key}` : null;
  return { url, key, bearer };
}

export function hasSupabaseManualEventsConfig() {
  const { url, key } = supabaseConfig();
  return Boolean(url && key);
}

export function manualEventsStoreMode() {
  return hasSupabaseManualEventsConfig() ? "supabase-canonical" : "local-snapshot-readonly";
}

export function manualEventsCanonicalWriteAvailable() {
  return hasSupabaseManualEventsConfig();
}

function redact(text) {
  const { url, key } = supabaseConfig();
  let output = String(text || "");
  if (key) output = output.replaceAll(key, "<redacted>");
  if (url) output = output.replaceAll(url, "<supabase-url>");
  return output.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

async function supabaseRequest(path, options = {}) {
  const { url, key, bearer } = supabaseConfig();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required");
  const headers = {
    apikey: key,
    ...(bearer ? { Authorization: bearer } : {}),
    "Content-Type": "application/json",
    ...(options.prefer ? { Prefer: options.prefer } : {}),
  };
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${redact(text)}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function rowKey(row) {
  return `${row.series_id}::${row.event_date}`;
}

function eventKey(event) {
  return `${event.seriesId}::${event.date}`;
}

function metadataFromEvent(event) {
  const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
    ? { ...event.metadata }
    : {};
  for (const [key, value] of Object.entries(event)) {
    if (!CORE_EVENT_KEYS.has(key) && value !== "" && value != null) {
      metadata[key] = value;
    }
  }
  return metadata;
}

function eventToSupabaseRow(event) {
  const row = {
    status: cleanText(event.status || "draft"),
    event_date: cleanText(event.date),
    series_id: cleanText(event.seriesId),
    label: nullableText(event.label),
    label_zh: nullableText(event.labelZh),
    label_en: nullableText(event.labelEn),
    category: cleanText(event.category),
    role: cleanText(event.role || "manual_liquidity_event"),
    cadence: cleanText(event.cadence || "event"),
    unit: cleanText(event.unit || "event"),
    source: cleanText(event.source),
    note: nullableText(event.note),
    metadata: metadataFromEvent(event),
    updated_by: cleanText(process.env.CYCLE_MAP_ADMIN_ACTOR || "local_admin"),
  };
  for (const [eventField, rowField] of TEXT_FIELDS) {
    row[rowField] = eventField === "releaseTimeUtc" ? normalizeUtc(event[eventField]) : nullableText(event[eventField]);
  }
  for (const [eventField, rowField] of NUMERIC_FIELDS) {
    row[rowField] = nullableNumber(event[eventField]);
  }
  return row;
}

function supabaseRowToEvent(row) {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata
    : {};
  const event = {
    status: cleanText(row.status || "draft"),
    date: cleanText(row.event_date),
    seriesId: cleanText(row.series_id),
    label: cleanText(row.label),
    labelZh: cleanText(row.label_zh),
    labelEn: cleanText(row.label_en),
    category: cleanText(row.category),
    role: cleanText(row.role || "manual_liquidity_event"),
    cadence: cleanText(row.cadence || "event"),
    unit: cleanText(row.unit || "event"),
    source: cleanText(row.source),
    sourceUrl: cleanText(row.source_url),
    dateMeaning: cleanText(row.date_meaning || "scheduled_beijing_date"),
    actual: nullableNumber(row.actual),
    previous: nullableNumber(row.previous),
    forecast: nullableNumber(row.forecast),
    change: nullableNumber(row.change),
    changeBp: nullableNumber(row.change_bp),
    pctChange: nullableNumber(row.pct_change),
    yearAgo: nullableNumber(row.year_ago),
    yoyPct: nullableNumber(row.yoy_pct),
    note: cleanText(row.note),
    ...metadata,
  };
  const releaseTimeUtc = normalizeUtc(row.release_time_utc);
  if (releaseTimeUtc) event.releaseTimeUtc = releaseTimeUtc;
  return event;
}

async function readSupabaseRows() {
  const query = [
    "select=*",
    "order=event_date.asc,category.asc,series_id.asc",
  ].join("&");
  return await supabaseRequest(`${SUPABASE_TABLE}?${query}`) || [];
}

export async function readManualEventsPayloadFromSupabase() {
  const rows = await readSupabaseRows();
  const updatedAt = rows
    .map((row) => normalizeUtc(row.updated_at))
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    version: 1,
    updatedAt: updatedAt || isoNow(),
    events: rows.map(supabaseRowToEvent),
  };
}

export async function writeManualEventsPayloadToSupabase(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const rows = events.map(eventToSupabaseRow);
  const existingRows = await readSupabaseRows();
  const nextKeys = new Set(events.map(eventKey));
  const staleRows = existingRows.filter((row) => !nextKeys.has(rowKey(row)));

  if (rows.length) {
    await supabaseRequest(`${SUPABASE_TABLE}?on_conflict=series_id,event_date`, {
      method: "POST",
      body: rows,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  for (const row of staleRows) {
    if (!row.id) continue;
    await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(row.id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
  }

  return {
    upserted: rows.length,
    deleted: staleRows.length,
  };
}
