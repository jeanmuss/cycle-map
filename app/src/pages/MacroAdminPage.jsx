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
  MACRO_WEEK_ROWS,
  MACRO_STATUS_DISPLAY,
  MACRO_CATEGORY_ORDER,
  MONTH_CELL_ITEM_LIMIT,
  utcDateFromKey,
  dateKeyFromUtc,
  calendarTimeZone,
  dateKeyInTimeZone,
  localDateKey,
  localDateKeyForLanguage,
  useAutoLocalDateKey,
  addUtcDays,
  startOfSundayWeek,
  weekDaysFor,
  monthKeyFromDateKey,
  monthGrid,
  shiftMonth,
  monthTitle,
  dayLabel,
  sameOrBefore,
  findCurrentWeeklyState,
  findWeeklyStateForDate,
  macroEventLabel,
  compactIndicatorLabel,
  compactEventLabel,
  eventWeekText,
  eventMonthText,
  statusChipText,
  statusItemsForWeek,
  statusItemsForDate,
  flowItemsForDate,
  calendarDateKeyForEvent,
  eventsByDate,
  isHolidayEvent,
  holidayCountryCode,
  holidayCountryLabel,
  holidayCountryCodesForDate,
  buildWeekCellItems,
  buildWeekDayItems,
  statusGroupItemsForDate,
  monthItemWeight,
  limitMonthItems,
  buildMonthItems,
  buildMonthDetailItems,
  pressureSignal,
  environmentDeltaText,
  macroUsdBillions,
  formatMacroUsdLiquidity,
  netLiquidityCard,
  environmentSummary,
  MacroEnvironmentPanel,
  MacroWeekCalendar,
  MacroMonthCalendar,
  holidayDisplayName,
  holidayDateNote,
  MacroDateEventDetail,
  MacroDateDetails,
  MacroSummaryStrip,
  MacroEventsTable,
  MacroStateCell,
  MacroStateTable,
  MacroDetailBand,
  MacroCalendarPage,
} from "./MacroPage.jsx";

export const ADMIN_MACRO_API_BASE = "http://127.0.0.1:5174";
export const ADMIN_MACRO_CATEGORIES = ["inflation", "growth", "rates", "volatility", "liquidity", "other"];
export const ADMIN_MACRO_DATE_MEANINGS = [
  "scheduled_beijing_date",
  "daily_observation",
  "observation_period",
  "observation_week",
  "observed_holiday_date",
];

export function adminMacroCopy(t) {
  const zh = t.htmlLang === "zh-CN";
  return zh ? {
    docTitle: "宏观事件后台",
    docDescription: "本地维护宏观流动性手动事件",
    eyebrow: "LOCAL ADMIN",
    title: "宏观事件后台",
    subtitle: "配置 Supabase 时编辑数据库事件，并同步到本地缓存供日历脚本使用。",
    api: "本地 API",
    connected: "已连接",
    disconnected: "未连接",
    reload: "重新载入",
    saveAll: "保存事件",
    validate: "校验事件",
    publish: "发布到日历缓存",
    saveDraft: "更新当前事件",
    newEvent: "新建事件",
    duplicate: "复制",
    delete: "删除",
    eventList: "手动事件",
    editor: "事件编辑",
    preview: "时区预览",
    empty: "暂无手动事件",
    localOnly: "只连接 127.0.0.1:5174。密钥只由本地 API 读取，不进入浏览器或公开构建。",
    startApi: "先运行 npm run admin:macro-events，再运行 npm run dev 打开本页。",
    fields: {
      status: "状态",
      date: "日历日期",
      seriesId: "事件 ID",
      labelZh: "中文标题",
      labelEn: "英文标题",
      category: "类别",
      role: "角色",
      unit: "单位",
      source: "来源",
      sourceUrl: "来源链接",
      dateMeaning: "日期语义",
      releaseTimeUtc: "发布时间 UTC",
      actual: "实际",
      previous: "前值",
      forecast: "预测",
      note: "备注",
    },
    statusOptions: [
      { value: "published", label: "发布" },
      { value: "draft", label: "草稿" },
      { value: "archived", label: "归档" },
    ],
    validation: {
      date: "日期需要 YYYY-MM-DD",
      seriesId: "事件 ID 必填，只使用大写字母、数字、下划线、冒号或短横线",
      label: "中文或英文标题至少填一个",
      source: "来源必填",
      releaseTimeUtc: "UTC 发布时间无法解析",
    },
    saved: "已保存",
    loaded: "已载入",
    draftSaved: "当前事件已更新到列表，记得保存事件。",
    validationPassed: "校验通过",
    publishPassed: "发布完成",
    publishing: "处理中",
    publishStatus: "发布状态",
    manualEvents: "手动事件",
    publishedEvents: "可发布",
    draftEvents: "草稿",
    archivedEvents: "归档",
    calendarGenerated: "日历缓存",
    missingEvents: "未发布",
    readyToPublish: "已同步",
    beijingDate: "北京时间日期",
    newYorkDate: "纽约日期",
    displayDate: "保存日期",
    noReleaseTime: "未填写 UTC 发布时间时，中英日历都按保存日期落点。",
  } : {
    docTitle: "Macro Event Admin",
    docDescription: "Local editor for manual macro-liquidity events",
    eyebrow: "LOCAL ADMIN",
    title: "Macro Event Admin",
    subtitle: "Edit Supabase-backed events when configured, with a local cache for the calendar script.",
    api: "Local API",
    connected: "Connected",
    disconnected: "Disconnected",
    reload: "Reload",
    saveAll: "Save events",
    validate: "Validate events",
    publish: "Publish calendar cache",
    saveDraft: "Update event",
    newEvent: "New event",
    duplicate: "Duplicate",
    delete: "Delete",
    eventList: "Manual events",
    editor: "Event editor",
    preview: "Time-zone preview",
    empty: "No manual events yet",
    localOnly: "Only talks to 127.0.0.1:5174. Secrets are read by the local API only and never reach the browser or public build.",
    startApi: "Run npm run admin:macro-events, then npm run dev to use this page.",
    readOnly: "The Supabase canonical store is not configured; the repository snapshot is read-only.",
    fields: {
      status: "Status",
      date: "Calendar date",
      seriesId: "Event ID",
      labelZh: "Chinese title",
      labelEn: "English title",
      category: "Category",
      role: "Role",
      unit: "Unit",
      source: "Source",
      sourceUrl: "Source URL",
      dateMeaning: "Date meaning",
      releaseTimeUtc: "Release time UTC",
      actual: "Actual",
      previous: "Previous",
      forecast: "Forecast",
      note: "Note",
    },
    statusOptions: [
      { value: "published", label: "Published" },
      { value: "draft", label: "Draft" },
      { value: "archived", label: "Archived" },
    ],
    validation: {
      date: "Date must be YYYY-MM-DD",
      seriesId: "Event ID is required and should use uppercase letters, numbers, underscores, colons, or hyphens",
      label: "Provide at least one Chinese or English title",
      source: "Source is required",
      releaseTimeUtc: "UTC release time cannot be parsed",
    },
    saved: "Saved",
    loaded: "Loaded",
    draftSaved: "Current event was updated in the list. Remember to save events.",
    validationPassed: "Validation passed",
    publishPassed: "Publish complete",
    publishing: "Working",
    publishStatus: "Publish status",
    manualEvents: "Manual events",
    publishedEvents: "Publishable",
    draftEvents: "Drafts",
    archivedEvents: "Archived",
    calendarGenerated: "Calendar cache",
    missingEvents: "Missing",
    readyToPublish: "Synced",
    beijingDate: "Beijing date",
    newYorkDate: "New York date",
    displayDate: "Saved date",
    noReleaseTime: "Without a UTC release time, both calendar languages use the saved date.",
  };
}

export function blankAdminMacroEvent(language) {
  const date = localDateKeyForLanguage(language);
  const suffix = date.replaceAll("-", "");
  return {
    status: "draft",
    date,
    seriesId: `MANUAL_LIQUIDITY_${suffix}`,
    label: "",
    labelZh: "",
    labelEn: "",
    category: "liquidity",
    role: "manual_liquidity_event",
    cadence: "event",
    unit: "event",
    source: "",
    sourceUrl: "",
    dateMeaning: "scheduled_beijing_date",
    releaseTimeUtc: "",
    actual: "",
    previous: "",
    forecast: "",
    note: "",
  };
}

export function adminEventKey(event) {
  return `${event?.seriesId || "event"}::${event?.date || "date"}`;
}

export function adminEventLabel(event, language) {
  return (language === "en" ? event?.labelEn : event?.labelZh) || event?.label || event?.seriesId || "N/A";
}

export function adminFormatDateTime(value, timeZone, language) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function adminValidationErrors(event, copy) {
  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(event.date || ""))) errors.push(copy.validation.date);
  if (!/^[A-Z0-9_:-]{3,80}$/.test(String(event.seriesId || ""))) errors.push(copy.validation.seriesId);
  if (!String(event.labelZh || event.labelEn || event.label || "").trim()) errors.push(copy.validation.label);
  if (!String(event.source || "").trim()) errors.push(copy.validation.source);
  if (event.releaseTimeUtc && Number.isNaN(new Date(event.releaseTimeUtc).getTime())) errors.push(copy.validation.releaseTimeUtc);
  return errors;
}

export function normalizeAdminEventForList(event) {
  const label = String(event.label || [event.labelZh, event.labelEn].filter(Boolean).join(" / ")).trim();
  const numberOrNull = (value) => value === "" || value == null ? null : Number(value);
  return {
    ...event,
    label,
    actual: numberOrNull(event.actual),
    previous: numberOrNull(event.previous),
    forecast: numberOrNull(event.forecast),
  };
}

export function AdminField({ label, children }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function AdminPublishStatus({ status, copy, language }) {
  if (!status) return null;
  const missing = Array.isArray(status.missingManualEvents) ? status.missingManualEvents : [];
  const labelFor = (event) => (language === "en" ? event.labelEn : event.labelZh) || event.label || event.seriesId;
  return (
    <section className="admin-publish-status" aria-label={copy.publishStatus}>
      <div>
        <small>{copy.publishStatus}</small>
        <strong className={status.ok ? "macro-up" : "macro-down"}>{status.ok ? copy.readyToPublish : `${missing.length} ${copy.missingEvents}`}</strong>
      </div>
      <dl>
        <div><dt>{copy.manualEvents}</dt><dd>{status.manualEventCount ?? 0}</dd></div>
        <div><dt>{copy.publishedEvents}</dt><dd>{status.publishedManualEventCount ?? 0}</dd></div>
        <div><dt>{copy.draftEvents}</dt><dd>{status.draftManualEventCount ?? 0}</dd></div>
        <div><dt>{copy.archivedEvents}</dt><dd>{status.archivedManualEventCount ?? 0}</dd></div>
        <div><dt>{copy.calendarGenerated}</dt><dd>{status.macroCalendarGeneratedAt ? freshnessLabel(status.macroCalendarGeneratedAt, language) : "N/A"}</dd></div>
      </dl>
      {missing.length ? (
        <ul>
          {missing.slice(0, 6).map((event) => (
            <li key={`${event.seriesId}-${event.date}`}>{event.date} / {labelFor(event)}</li>
          ))}
        </ul>
      ) : null}
      {status.calendarError ? <p>{status.calendarError}</p> : null}
    </section>
  );
}

export function adminResponseJson(response) {
  return response.json()
    .catch(() => ({}))
    .then((data) => {
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      return data;
    });
}

export function AdminMacroEventsPage({ language, setLanguage, t }) {
  const copy = adminMacroCopy(t);
  const [payload, setPayload] = useState({ version: 1, updatedAt: null, events: [] });
  const [draft, setDraft] = useState(() => blankAdminMacroEvent(language));
  const [selectedKey, setSelectedKey] = useState("");
  const [apiState, setApiState] = useState("loading");
  const [message, setMessage] = useState("");
  const [publishStatus, setPublishStatus] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [canonicalWriteAvailable, setCanonicalWriteAvailable] = useState(false);

  const loadPublishStatus = () => {
    fetch(`${ADMIN_MACRO_API_BASE}/macro-calendar-status`, { cache: "no-store" })
      .then(adminResponseJson)
      .then((data) => setPublishStatus(data))
      .catch(() => setPublishStatus(null));
  };

  const loadEvents = () => {
    setApiState("loading");
    fetch(`${ADMIN_MACRO_API_BASE}/manual-macro-events`, { cache: "no-store" })
      .then(adminResponseJson)
      .then((data) => {
        const nextPayload = { version: 1, updatedAt: data.updatedAt || null, events: Array.isArray(data.events) ? data.events : [] };
        const writable = Boolean(data.canonicalWriteAvailable);
        setPayload(nextPayload);
        setCanonicalWriteAvailable(writable);
        const first = nextPayload.events[0] || blankAdminMacroEvent(language);
        setDraft({ ...first });
        setSelectedKey(nextPayload.events[0] ? adminEventKey(first) : "");
        setApiState("connected");
        setMessage(writable ? copy.loaded : (copy.readOnly || "Supabase 规范源未配置；当前仓库快照只读。"));
        loadPublishStatus();
      })
      .catch((error) => {
        setApiState("disconnected");
        setMessage(error.message);
      });
  };

  const runAdminCommand = (path, successMessage) => {
    setBusyAction(path);
    fetch(`${ADMIN_MACRO_API_BASE}/${path}`, {
      method: "POST",
      headers: { "x-cycle-map-admin": "1" },
    })
      .then(adminResponseJson)
      .then((data) => {
        setApiState("connected");
        setPublishStatus(data.status || data);
        setMessage(successMessage);
      })
      .catch((error) => {
        const networkIssue = error.message.includes("Failed to fetch") || error.message.includes("NetworkError");
        setApiState(networkIssue ? "disconnected" : "connected");
        setMessage(error.message);
      })
      .finally(() => setBusyAction(""));
  };

  useEffect(() => {
    loadEvents();
    replaceHashState("admin/macro-events", {});
  }, []);

  const validationErrors = useMemo(() => adminValidationErrors(draft, copy), [draft, copy]);
  const hasErrors = validationErrors.length > 0;
  const releaseTime = draft.releaseTimeUtc || "";
  const beijingDate = releaseTime ? dateKeyInTimeZone(releaseTime, "Asia/Shanghai") : draft.date;
  const newYorkDate = releaseTime ? dateKeyInTimeZone(releaseTime, "America/New_York") : draft.date;
  const selectedIndex = payload.events.findIndex((event) => adminEventKey(event) === selectedKey);
  const canWrite = apiState === "connected" && canonicalWriteAvailable && !busyAction;

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const selectEvent = (event) => {
    setSelectedKey(adminEventKey(event));
    setDraft({ ...event });
    setMessage("");
  };
  const newEvent = () => {
    const event = blankAdminMacroEvent(language);
    setSelectedKey("");
    setDraft(event);
    setMessage("");
  };
  const duplicateEvent = () => {
    const dateSuffix = String(draft.date || "").replaceAll("-", "");
    setSelectedKey("");
    setDraft({ ...draft, status: "draft", seriesId: `${draft.seriesId || "MANUAL_EVENT"}_COPY_${dateSuffix}` });
  };
  const updateEventList = () => {
    if (hasErrors) return;
    const normalized = normalizeAdminEventForList(draft);
    setPayload((current) => {
      const events = [...current.events];
      if (selectedIndex >= 0) events[selectedIndex] = normalized;
      else events.unshift(normalized);
      return { ...current, events };
    });
    setSelectedKey(adminEventKey(normalized));
    setDraft(normalized);
    setMessage(copy.draftSaved);
  };
  const deleteEvent = () => {
    setPayload((current) => ({ ...current, events: current.events.filter((event) => adminEventKey(event) !== selectedKey) }));
    newEvent();
  };
  const saveAll = () => {
    if (!canonicalWriteAvailable) {
      setMessage(copy.readOnly || "Supabase 规范源未配置；当前仓库快照只读。");
      return;
    }
    fetch(`${ADMIN_MACRO_API_BASE}/manual-macro-events`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-cycle-map-admin": "1",
      },
      body: JSON.stringify({ version: 1, events: payload.events }),
    })
      .then(adminResponseJson)
      .then((data) => {
        setPayload(data);
        setApiState("connected");
        setMessage(copy.saved);
        loadPublishStatus();
      })
      .catch((error) => {
        setApiState("disconnected");
        setMessage(error.message);
      });
  };

  return (
    <main className="app-page admin-page">
      <header className="app-header">
        <div className="title-block">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
          <PageNav page="macroAdmin" t={t} />
        </div>
        <div className="freshness-block">
          <LanguageToggle language={language} onChange={setLanguage} t={t} />
          <CacheStatus label={copy.api} tooltip={copy.localOnly} />
          <strong className={apiState === "connected" ? "macro-up" : "macro-down"}>
            {apiState === "connected" ? copy.connected : copy.disconnected}
          </strong>
          <small>{message || copy.startApi}</small>
        </div>
      </header>

      <section className="admin-toolbar" aria-label={copy.editor}>
        <button type="button" onClick={loadEvents}>{copy.reload}</button>
        <button type="button" onClick={newEvent} disabled={!canWrite}>{copy.newEvent}</button>
        <button type="button" onClick={duplicateEvent} disabled={!canWrite}>{copy.duplicate}</button>
        <button type="button" onClick={deleteEvent} disabled={!selectedKey || !canWrite}>{copy.delete}</button>
        <button type="button" onClick={() => runAdminCommand("validate-macro-events", copy.validationPassed)} disabled={apiState !== "connected" || Boolean(busyAction)}>{busyAction === "validate-macro-events" ? copy.publishing : copy.validate}</button>
        <button type="button" onClick={() => runAdminCommand("publish-macro-calendar", copy.publishPassed)} disabled={!canWrite}>{busyAction === "publish-macro-calendar" ? copy.publishing : copy.publish}</button>
        <button type="button" className="admin-primary-action" onClick={saveAll} disabled={!canWrite}>{copy.saveAll}</button>
      </section>

      <div className="admin-macro-layout">
        <aside className="admin-event-list" aria-label={copy.eventList}>
          <div className="macro-section-heading">
            <div>
              <p>{copy.api}</p>
              <h2>{copy.eventList}</h2>
            </div>
            <span>{payload.events.length}</span>
          </div>
          {payload.events.length ? payload.events.map((event) => (
            <button
              type="button"
              className={adminEventKey(event) === selectedKey ? "is-selected" : ""}
              onClick={() => selectEvent(event)}
              key={adminEventKey(event)}
            >
              <strong>{adminEventLabel(event, language)}</strong>
              <span>{event.date} / {event.category}</span>
              <em>{event.status || "published"}</em>
            </button>
          )) : <p className="admin-empty">{copy.empty}</p>}
        </aside>

        <section className="admin-editor" aria-label={copy.editor}>
          <div className="macro-section-heading">
            <div>
              <p>{copy.editor}</p>
              <h2>{adminEventLabel(draft, language)}</h2>
            </div>
            <button type="button" onClick={updateEventList} disabled={hasErrors || !canWrite}>{copy.saveDraft}</button>
          </div>

          {hasErrors ? (
            <div className="admin-validation">
              {validationErrors.map((error) => <span key={error}>{error}</span>)}
            </div>
          ) : null}

          <div className="admin-form-grid">
            <AdminField label={copy.fields.status}>
              <select value={draft.status || "published"} onChange={(event) => updateDraft("status", event.target.value)}>
                {copy.statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </AdminField>
            <AdminField label={copy.fields.date}>
              <input type="date" value={draft.date || ""} onChange={(event) => updateDraft("date", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.seriesId}>
              <input value={draft.seriesId || ""} onChange={(event) => updateDraft("seriesId", event.target.value.toUpperCase())} />
            </AdminField>
            <AdminField label={copy.fields.category}>
              <select value={draft.category || "liquidity"} onChange={(event) => updateDraft("category", event.target.value)}>
                {ADMIN_MACRO_CATEGORIES.map((category) => <option value={category} key={category}>{macroCategoryLabel(category, t)}</option>)}
              </select>
            </AdminField>
            <AdminField label={copy.fields.labelZh}>
              <input value={draft.labelZh || ""} onChange={(event) => updateDraft("labelZh", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.labelEn}>
              <input value={draft.labelEn || ""} onChange={(event) => updateDraft("labelEn", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.role}>
              <input value={draft.role || ""} onChange={(event) => updateDraft("role", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.unit}>
              <input value={draft.unit || ""} onChange={(event) => updateDraft("unit", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.source}>
              <input value={draft.source || ""} onChange={(event) => updateDraft("source", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.sourceUrl}>
              <input value={draft.sourceUrl || ""} onChange={(event) => updateDraft("sourceUrl", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.dateMeaning}>
              <select value={draft.dateMeaning || "scheduled_beijing_date"} onChange={(event) => updateDraft("dateMeaning", event.target.value)}>
                {ADMIN_MACRO_DATE_MEANINGS.map((value) => <option value={value} key={value}>{macroDateMeaningLabel(value, t)}</option>)}
              </select>
            </AdminField>
            <AdminField label={copy.fields.releaseTimeUtc}>
              <input placeholder="2026-07-19T19:00:00Z" value={draft.releaseTimeUtc || ""} onChange={(event) => updateDraft("releaseTimeUtc", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.actual}>
              <input inputMode="decimal" value={draft.actual ?? ""} onChange={(event) => updateDraft("actual", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.previous}>
              <input inputMode="decimal" value={draft.previous ?? ""} onChange={(event) => updateDraft("previous", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.forecast}>
              <input inputMode="decimal" value={draft.forecast ?? ""} onChange={(event) => updateDraft("forecast", event.target.value)} />
            </AdminField>
            <AdminField label={copy.fields.note}>
              <textarea value={draft.note || ""} onChange={(event) => updateDraft("note", event.target.value)} rows={5} />
            </AdminField>
          </div>
        </section>

        <aside className="admin-preview" aria-label={copy.preview}>
          <div className="macro-section-heading">
            <div>
              <p>{copy.preview}</p>
              <h2>{copy.displayDate}</h2>
            </div>
          </div>
          <dl>
            <div><dt>{copy.displayDate}</dt><dd>{draft.date || "N/A"}</dd></div>
            <div><dt>{copy.beijingDate}</dt><dd>{beijingDate || "N/A"}</dd></div>
            <div><dt>{copy.newYorkDate}</dt><dd>{newYorkDate || "N/A"}</dd></div>
            <div><dt>UTC</dt><dd>{releaseTime || "N/A"}</dd></div>
            <div><dt>UTC+8</dt><dd>{releaseTime ? adminFormatDateTime(releaseTime, "Asia/Shanghai", language) : "N/A"}</dd></div>
            <div><dt>ET</dt><dd>{releaseTime ? adminFormatDateTime(releaseTime, "America/New_York", language) : "N/A"}</dd></div>
          </dl>
          <AdminPublishStatus status={publishStatus} copy={copy} language={language} />
          <p>{releaseTime ? copy.localOnly : copy.noReleaseTime}</p>
        </aside>
      </div>
    </main>
  );
}

export const macroAdminMetadata = (t) => { const copy = adminMacroCopy(t); return { title: copy.docTitle, description: copy.docDescription }; };
