import assert from "node:assert/strict";
import {
  buildOfficialMarketCalendar,
  statusAtTimeline,
} from "./market-session-calendar.mjs";

const markets = {
  us: {
    id: "us",
    timezone: "America/New_York",
    stateModel: "premarket_regular_afterhours",
    sessionTemplates: [
      { key: "premarket", start: "04:00", end: "09:30", active: true, sortRank: 1 },
      { key: "open", start: "09:30", end: "16:00", active: true, sortRank: 1 },
      { key: "afterhours", start: "16:00", end: "20:00", active: true, sortRank: 2 },
    ],
  },
  kr: {
    id: "kr",
    timezone: "Asia/Seoul",
    stateModel: "premarket_regular_afterhours",
    sessionTemplates: [
      { key: "premarket", start: "08:00", end: "09:00", active: true, sortRank: 1 },
      { key: "open", start: "09:00", end: "15:30", active: true, sortRank: 1 },
      { key: "afterhours", start: "15:40", end: "18:00", active: true, sortRank: 2 },
    ],
  },
  cn: {
    id: "cn",
    timezone: "Asia/Shanghai",
    stateModel: "china_auction_regular_afterhours",
    sessionTemplates: [
      { key: "opening-auction", start: "09:15", end: "09:25", active: true, sortRank: 1 },
      { key: "open", start: "09:30", end: "11:30", active: true, sortRank: 1 },
      { key: "lunch", start: "11:30", end: "13:00", active: false, sortRank: 3 },
      { key: "open", start: "13:00", end: "14:57", active: true, sortRank: 1 },
      { key: "closing-auction", start: "14:57", end: "15:00", active: true, sortRank: 1 },
    ],
  },
};

const timelines = Object.fromEntries(Object.entries(markets).map(([id, market]) => [
  id,
  buildOfficialMarketCalendar(market, new Date("2026-07-10T08:00:00Z"), { fullCoverage: true }).statusTimeline,
]));

function expectState(marketId, iso, key, active) {
  const status = statusAtTimeline(timelines[marketId], iso);
  assert.equal(status.key, key, `${marketId} ${iso}`);
  assert.equal(status.active, active, `${marketId} ${iso}`);
  return status;
}

expectState("us", "2026-07-11T16:00:00Z", "closed", false);
expectState("us", "2026-07-12T23:59:00Z", "closed", false);
expectState("us", "2026-09-07T14:00:00Z", "closed", false);
expectState("us", "2026-11-27T18:30:00Z", "afterhours", true);
expectState("us", "2026-11-27T22:30:00Z", "closed", false);
expectState("cn", "2026-10-05T02:00:00Z", "closed", false);
expectState("cn", "2026-07-10T03:45:00Z", "lunch", false);
expectState("kr", "2026-05-01T01:00:00Z", "closed", false);
expectState("kr", "2026-07-10T06:35:00Z", "soon", true);

const earlyClose = expectState("us", "2026-11-27T17:30:00Z", "open", true);
assert.equal(earlyClose.nextTransitionAt, "2026-11-27T18:00:00.000Z");

console.log("Verified official market-calendar boundaries for U.S., Korea, and China.");
