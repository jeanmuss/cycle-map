const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_WINDOW_MS = 60 * 60 * 1000;

const CALENDARS = {
  us: {
    coverageStart: "2026-01-01",
    coverageEnd: "2026-12-31",
    reviewedAt: "2026-07-10",
    sourceLabel: "NYSE 2026 holidays and trading hours",
    sourceUrl: "https://www.nyse.com/trade/hours-calendars",
    secondarySourceUrl: "https://www.nyse.com/publicdocs/nyse/NYSE_Extended_Hours_Trading_FAQ.pdf",
    holidays: {
      "2026-01-01": ["New Year's Day", "元旦"],
      "2026-01-19": ["Martin Luther King Jr. Day", "马丁·路德·金纪念日"],
      "2026-02-16": ["Washington's Birthday", "华盛顿诞辰日"],
      "2026-04-03": ["Good Friday", "耶稣受难日"],
      "2026-05-25": ["Memorial Day", "阵亡将士纪念日"],
      "2026-06-19": ["Juneteenth", "六月节"],
      "2026-07-03": ["Independence Day observed", "独立日补休"],
      "2026-09-07": ["Labor Day", "劳工节"],
      "2026-11-26": ["Thanksgiving Day", "感恩节"],
      "2026-12-25": ["Christmas Day", "圣诞节"],
    },
    earlyCloses: {
      "2026-11-27": {
        name: "Day after Thanksgiving early close",
        nameZh: "感恩节次日提前收市",
        sessionOverrides: {
          open: { end: "13:00" },
          afterhours: { start: "13:00", end: "17:00" },
        },
      },
      "2026-12-24": {
        name: "Christmas Eve early close",
        nameZh: "平安夜提前收市",
        sessionOverrides: {
          open: { end: "13:00" },
          afterhours: { start: "13:00", end: "17:00" },
        },
      },
    },
    notes: [
      "The current reviewed NYSE Arca schedule uses Early, Core, and Late sessions. The planned Overnight Session is not marked active before its announced launch and required approvals.",
    ],
  },
  kr: {
    coverageStart: "2026-01-01",
    coverageEnd: "2026-12-31",
    reviewedAt: "2026-07-10",
    sourceLabel: "KRX KOSPI holiday rules and 2026 exchange calendar disclosures",
    sourceUrl: "https://global.krx.co.kr/contents/GLB/06/0602/0602010201/GLB0602010201T1.jsp",
    holidays: {
      "2026-01-01": ["New Year's Day", "元旦"],
      "2026-02-16": ["Seollal holiday", "韩国春节休市"],
      "2026-02-17": ["Seollal", "韩国春节休市"],
      "2026-02-18": ["Seollal holiday", "韩国春节休市"],
      "2026-03-02": ["Independence Movement Day observed", "三一节补休"],
      "2026-05-01": ["Labor Day", "劳动节"],
      "2026-05-05": ["Children's Day", "儿童节"],
      "2026-05-25": ["Buddha's Birthday observed", "佛诞日补休"],
      "2026-06-03": ["Local election day", "地方选举日"],
      "2026-08-17": ["Liberation Day observed", "光复节补休"],
      "2026-09-24": ["Chuseok holiday", "中秋节休市"],
      "2026-09-25": ["Chuseok", "中秋节休市"],
      "2026-10-05": ["National Foundation Day observed", "开天节补休"],
      "2026-10-09": ["Hangul Day", "韩文日"],
      "2026-12-25": ["Christmas Day", "圣诞节"],
      "2026-12-31": ["KRX year-end closing day", "韩国交易所年末休市"],
    },
    earlyCloses: {},
  },
  cn: {
    coverageStart: "2026-01-01",
    coverageEnd: "2026-12-31",
    reviewedAt: "2026-07-10",
    sourceLabel: "SSE 2026 market closure notice and 2026 trading rules",
    sourceUrl: "https://www.sse.com.cn/disclosure/dealinstruc/closed/",
    secondarySourceUrl: "https://www.sse.com.cn/lawandrules/sselawsrules2025/stocks/exchange/c/c_20260424_10816482.shtml",
    holidays: {
      "2026-01-01": ["New Year holiday", "元旦休市"],
      "2026-01-02": ["New Year holiday", "元旦休市"],
      "2026-02-16": ["Spring Festival holiday", "春节休市"],
      "2026-02-17": ["Spring Festival holiday", "春节休市"],
      "2026-02-18": ["Spring Festival holiday", "春节休市"],
      "2026-02-19": ["Spring Festival holiday", "春节休市"],
      "2026-02-20": ["Spring Festival holiday", "春节休市"],
      "2026-02-23": ["Spring Festival holiday", "春节休市"],
      "2026-04-06": ["Qingming Festival holiday", "清明节休市"],
      "2026-05-01": ["Labor Day holiday", "劳动节休市"],
      "2026-05-04": ["Labor Day holiday", "劳动节休市"],
      "2026-05-05": ["Labor Day holiday", "劳动节休市"],
      "2026-06-19": ["Dragon Boat Festival holiday", "端午节休市"],
      "2026-09-25": ["Mid-Autumn Festival holiday", "中秋节休市"],
      "2026-10-01": ["National Day holiday", "国庆节休市"],
      "2026-10-02": ["National Day holiday", "国庆节休市"],
      "2026-10-05": ["National Day holiday", "国庆节休市"],
      "2026-10-06": ["National Day holiday", "国庆节休市"],
      "2026-10-07": ["National Day holiday", "国庆节休市"],
    },
    earlyCloses: {},
  },
};

function dateParts(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return { year, month, day };
}

function addDays(dateKey, days) {
  const { year, month, day } = dateParts(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function weekday(dateKey) {
  const { year, month, day } = dateParts(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function timeZoneOffsetMs(timeZone, date) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return localAsUtc - date.getTime();
}

export function zonedDateTimeToIso(dateKey, timeValue, timeZone) {
  const { year, month, day } = dateParts(dateKey);
  const [hour, minute] = String(timeValue).split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = new Date(target);
  for (let index = 0; index < 3; index += 1) {
    guess = new Date(target - timeZoneOffsetMs(timeZone, guess));
  }
  return guess.toISOString();
}

function closedSegment(startAt, endAt, reason, reasonZh, tradeDate) {
  return {
    key: "closed",
    active: false,
    sortRank: 4,
    startAt,
    endAt,
    tradeDate,
    reason,
    reasonZh,
  };
}

function dayReason(dateKey, calendar) {
  const holiday = calendar.holidays[dateKey];
  if (holiday) return { reason: holiday[0], reasonZh: holiday[1] };
  if ([0, 6].includes(weekday(dateKey))) return { reason: "Exchange weekend", reasonZh: "交易所周末休市" };
  return null;
}

function sessionsForDate(market, dateKey, calendar) {
  const earlyClose = calendar.earlyCloses[dateKey];
  return market.sessionTemplates.map((template) => {
    const override = earlyClose?.sessionOverrides?.[template.key] || {};
    return {
      ...template,
      start: override.start || template.start,
      end: override.end || template.end,
      tradeDate: dateKey,
      reason: earlyClose?.name || null,
      reasonZh: earlyClose?.nameZh || null,
    };
  });
}

function localDateKey(date, timeZone) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function buildRawTimeline(market, calendar, timelineStart, timelineEnd) {
  const timeline = [];
  for (let dateKey = timelineStart; dateKey <= timelineEnd; dateKey = addDays(dateKey, 1)) {
    const dayStart = zonedDateTimeToIso(dateKey, "00:00", market.timezone);
    const nextDate = addDays(dateKey, 1);
    const dayEnd = zonedDateTimeToIso(nextDate, "00:00", market.timezone);
    const closure = dayReason(dateKey, calendar);
    if (closure) {
      timeline.push(closedSegment(dayStart, dayEnd, closure.reason, closure.reasonZh, dateKey));
      continue;
    }

    let cursor = dayStart;
    for (const session of sessionsForDate(market, dateKey, calendar)) {
      const startAt = zonedDateTimeToIso(dateKey, session.start, market.timezone);
      const endAt = zonedDateTimeToIso(dateKey, session.end, market.timezone);
      if (Date.parse(startAt) > Date.parse(cursor)) {
        timeline.push(closedSegment(cursor, startAt, "Outside official session", "非官方交易时段", dateKey));
      }
      timeline.push({
        key: session.key,
        active: session.active,
        sortRank: session.sortRank,
        startAt,
        endAt,
        tradeDate: dateKey,
        reason: session.reason,
        reasonZh: session.reasonZh,
      });
      cursor = endAt;
    }
    if (Date.parse(cursor) < Date.parse(dayEnd)) {
      timeline.push(closedSegment(cursor, dayEnd, "Outside official session", "非官方交易时段", dateKey));
    }
  }
  return timeline;
}

function addSoonWindows(timeline) {
  const output = [];
  for (let index = 0; index < timeline.length; index += 1) {
    const entry = timeline[index];
    const next = timeline[index + 1];
    if (entry.key !== "closed" || !next?.active || Date.parse(entry.endAt) !== Date.parse(next.startAt)) {
      output.push(entry);
      continue;
    }
    const startMs = Date.parse(entry.startAt);
    const endMs = Date.parse(entry.endAt);
    const soonStartMs = Math.max(startMs, endMs - SOON_WINDOW_MS);
    if (soonStartMs > startMs) output.push({ ...entry, endAt: new Date(soonStartMs).toISOString() });
    output.push({
      key: "soon",
      active: true,
      sortRank: 1,
      startAt: new Date(soonStartMs).toISOString(),
      endAt: entry.endAt,
      tradeDate: next.tradeDate,
      reason: next.reason,
      reasonZh: next.reasonZh,
    });
  }
  return output;
}

function attachNextTransitions(timeline) {
  return timeline.map((entry, index) => {
    let nextIndex = index + 1;
    while (
      nextIndex < timeline.length
      && timeline[nextIndex].key === entry.key
      && timeline[nextIndex].active === entry.active
    ) nextIndex += 1;
    return {
      ...entry,
      nextTransitionAt: timeline[nextIndex]?.startAt || entry.endAt,
    };
  });
}

export function statusAtTimeline(timeline, value) {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  const entry = timeline.find((item) => Date.parse(item.startAt) <= time && time < Date.parse(item.endAt));
  if (!entry) return {
    key: "closed",
    active: false,
    sortRank: 4,
    nextTransitionAt: null,
    reason: "Official calendar coverage unavailable",
    reasonZh: "官方交易日历覆盖范围外",
  };
  return {
    key: entry.key,
    active: entry.active,
    sortRank: entry.sortRank,
    nextTransitionAt: entry.nextTransitionAt,
    reason: entry.reason,
    reasonZh: entry.reasonZh,
    tradeDate: entry.tradeDate,
  };
}

export function buildOfficialMarketCalendar(market, generatedAt = new Date(), options = {}) {
  if (market.stateModel === "always_open") {
    return {
      calendar: {
        kind: "continuous",
        coverageStart: null,
        coverageEnd: null,
        sourceLabel: "Continuous crypto market",
        sourceUrl: null,
      },
      statusTimeline: [],
      generatedStatus: {
        key: "trading",
        active: true,
        sortRank: 0,
        nextTransitionAt: null,
      },
    };
  }

  const calendar = CALENDARS[market.id];
  if (!calendar) throw new Error(`Official calendar is not configured for ${market.id}`);
  const generatedDateKey = localDateKey(generatedAt, market.timezone);
  const timelineStart = options.fullCoverage
    ? calendar.coverageStart
    : [calendar.coverageStart, addDays(generatedDateKey, -7)].sort().at(-1);
  const timelineEnd = options.fullCoverage
    ? calendar.coverageEnd
    : [calendar.coverageEnd, addDays(generatedDateKey, 45)].sort().at(0);
  const statusTimeline = attachNextTransitions(addSoonWindows(buildRawTimeline(market, calendar, timelineStart, timelineEnd)));
  return {
    calendar: {
      kind: "official_exchange_calendar",
      coverageStart: calendar.coverageStart,
      coverageEnd: calendar.coverageEnd,
      timelineStart,
      timelineEnd,
      reviewedAt: calendar.reviewedAt,
      sourceLabel: calendar.sourceLabel,
      sourceUrl: calendar.sourceUrl,
      secondarySourceUrl: calendar.secondarySourceUrl || null,
      holidays: Object.entries(calendar.holidays).map(([date, [name, nameZh]]) => ({ date, name, nameZh })),
      earlyCloses: Object.entries(calendar.earlyCloses).map(([date, value]) => ({ date, name: value.name, nameZh: value.nameZh })),
      notes: calendar.notes || [],
    },
    statusTimeline,
    generatedStatus: statusAtTimeline(statusTimeline, generatedAt),
  };
}
