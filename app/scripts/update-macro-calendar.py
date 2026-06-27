#!/usr/bin/env python
"""Build the static macro calendar cache for the frontend.

Security posture:
- Runs only as a backend/local/CI script.
- Uses official FRED API access through fredapi.
- Reads secrets from environment variables only; never writes them to output.
- Stores a local provider cache under tmp/ to avoid repeated API calls.
- Writes only bounded, derived half-year data for the frontend.

Important data semantics:
FRED observation dates are economic observation/period dates, not necessarily
the public release timestamps. This script marks that explicitly so the UI does
not present period dates as release dates.
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests

APP_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = APP_ROOT.parent
OUTPUT_PATH = APP_ROOT / "public" / "data" / "macro-calendar.json"
CACHE_DIR = WORKSPACE_ROOT / "tmp" / "macro-cache" / "fred"
FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"

WINDOW_MONTHS = int(os.environ.get("MACRO_CALENDAR_MONTHS", "6"))
CACHE_MAX_AGE_HOURS = float(os.environ.get("MACRO_CACHE_MAX_AGE_HOURS", "18"))
FORCE_REFRESH = os.environ.get("MACRO_CACHE_REFRESH", "").strip().lower() in {"1", "true", "yes"}
DEFAULT_END_DATE = pd.Timestamp(datetime.now(UTC).date())
END_DATE = pd.Timestamp(os.environ.get("MACRO_CALENDAR_END_DATE", DEFAULT_END_DATE.strftime("%Y-%m-%d")))
WINDOW_START = (END_DATE - pd.DateOffset(months=WINDOW_MONTHS)).normalize()
LOOKBACK_START = (WINDOW_START - pd.DateOffset(years=1, days=14)).normalize()


@dataclass(frozen=True)
class Indicator:
    id: str
    label: str
    category: str
    category_label: str
    role: str
    cadence: str
    unit: str
    source: str
    date_meaning: str
    include_yoy: bool = False
    change_mode: str = "level"
    note: str = ""


CATEGORIES = {
    "inflation": "Inflation",
    "growth": "Employment & Growth",
    "rates": "Rates & Dollar",
    "volatility": "Volatility & Credit",
    "liquidity": "Liquidity & Balance Sheet",
}


EVENT_SERIES: list[Indicator] = [
    Indicator("CPIAUCSL", "CPI", "inflation", CATEGORIES["inflation"], "release_observation", "monthly", "index", "FRED / BLS", "observation_period", True, "pct"),
    Indicator("CPILFESL", "Core CPI", "inflation", CATEGORIES["inflation"], "release_observation", "monthly", "index", "FRED / BLS", "observation_period", True, "pct"),
    Indicator("PPIACO", "PPI", "inflation", CATEGORIES["inflation"], "release_observation", "monthly", "index", "FRED / BLS", "observation_period", True, "pct"),
    Indicator("WPSFD4131", "Core PPI goods", "inflation", CATEGORIES["inflation"], "release_observation", "monthly", "index", "FRED / BLS", "observation_period", True, "pct"),
    Indicator("PCEPI", "PCE price index", "inflation", CATEGORIES["inflation"], "release_observation", "monthly", "index", "FRED / BEA", "observation_period", True, "pct"),
    Indicator("PCEPILFE", "Core PCE", "inflation", CATEGORIES["inflation"], "release_observation", "monthly", "index", "FRED / BEA", "observation_period", True, "pct"),
    Indicator("PAYEMS", "Nonfarm payrolls", "growth", CATEGORIES["growth"], "release_observation", "monthly", "thousand_persons", "FRED / BLS", "observation_period", False, "level"),
    Indicator("UNRATE", "Unemployment rate", "growth", CATEGORIES["growth"], "release_observation", "monthly", "percent", "FRED / BLS", "observation_period", False, "bp"),
    Indicator("CES0500000003", "Average hourly earnings", "growth", CATEGORIES["growth"], "release_observation", "monthly", "usd_per_hour", "FRED / BLS", "observation_period", True, "pct"),
    Indicator("ICSA", "Initial jobless claims", "growth", CATEGORIES["growth"], "release_observation", "weekly", "persons", "FRED / U.S. Employment and Training Administration", "observation_week", False, "level"),
    Indicator("RSAFS", "Retail sales", "growth", CATEGORIES["growth"], "release_observation", "monthly", "usd_millions", "FRED / U.S. Census Bureau", "observation_period", True, "pct"),
    Indicator("INDPRO", "Industrial production", "growth", CATEGORIES["growth"], "release_observation", "monthly", "index", "FRED / Federal Reserve", "observation_period", True, "pct"),
    Indicator("GDPC1", "Real GDP", "growth", CATEGORIES["growth"], "release_observation", "quarterly", "usd_billions_chained", "FRED / BEA", "observation_period", True, "pct"),
    Indicator("UMCSENT", "Consumer sentiment", "growth", CATEGORIES["growth"], "release_observation", "monthly", "index", "FRED / University of Michigan", "observation_period", False, "level"),
    Indicator("IRSTCI01JPM156N", "Japan overnight rate", "rates", CATEGORIES["rates"], "release_observation", "monthly", "percent", "FRED / OECD", "observation_period", False, "bp", "Short-term market-rate proxy for Japan, not a central-bank decision timestamp."),
    Indicator("IR3TIB01CNM156N", "China 3M interbank rate", "rates", CATEGORIES["rates"], "release_observation", "monthly", "percent", "FRED / OECD", "observation_period", False, "bp", "Three-month interbank market-rate proxy for China, not an official PBOC policy-rate decision timestamp."),
    Indicator("FEDTARMD", "FOMC fed funds median projection", "rates", CATEGORIES["rates"], "release_observation", "annual", "percent", "FRED / Federal Reserve SEP", "projection_year", False, "bp", "Annual projection-year dot-plot median, not the SEP publication date."),
    Indicator("FEDTARMDLR", "FOMC longer-run fed funds median", "rates", CATEGORIES["rates"], "release_observation", "event", "percent", "FRED / Federal Reserve SEP", "sep_release_observation", False, "bp", "Longer-run dot-plot median on SEP observation dates."),
    Indicator("M2SL", "M2 money stock", "liquidity", CATEGORIES["liquidity"], "release_observation", "monthly", "usd_billions", "FRED / Federal Reserve", "observation_period", True, "pct"),
]


STATUS_SERIES: list[Indicator] = [
    Indicator("DFEDTARU", "Fed target upper", "rates", CATEGORIES["rates"], "state", "daily", "percent", "FRED / Federal Reserve", "daily_observation", False, "bp"),
    Indicator("DFEDTARL", "Fed target lower", "rates", CATEGORIES["rates"], "state", "daily", "percent", "FRED / Federal Reserve", "daily_observation", False, "bp"),
    Indicator("DFF", "Effective fed funds", "rates", CATEGORIES["rates"], "state", "daily", "percent", "FRED / Federal Reserve", "daily_observation", False, "bp"),
    Indicator("DGS2", "2Y Treasury", "rates", CATEGORIES["rates"], "state", "daily", "percent", "FRED / U.S. Treasury", "daily_observation", False, "bp"),
    Indicator("DGS10", "10Y Treasury", "rates", CATEGORIES["rates"], "state", "daily", "percent", "FRED / U.S. Treasury", "daily_observation", False, "bp"),
    Indicator("DFII10", "10Y real yield", "rates", CATEGORIES["rates"], "state", "daily", "percent", "FRED / U.S. Treasury", "daily_observation", False, "bp"),
    Indicator("T10YIE", "10Y breakeven", "rates", CATEGORIES["rates"], "state", "daily", "percent", "FRED / Federal Reserve", "daily_observation", False, "bp"),
    Indicator("DTWEXBGS", "Broad USD index", "rates", CATEGORIES["rates"], "state", "daily", "index", "FRED / Federal Reserve", "daily_observation", False, "pct"),
    Indicator("DEXJPUS", "USD/JPY", "rates", CATEGORIES["rates"], "state", "daily", "fx", "FRED / Board of Governors", "daily_observation", False, "pct"),
    Indicator("DEXCHUS", "USD/CNY", "rates", CATEGORIES["rates"], "state", "daily", "fx", "FRED / Board of Governors", "daily_observation", False, "pct"),
    Indicator("VIXCLS", "VIX", "volatility", CATEGORIES["volatility"], "state", "daily", "index", "FRED / CBOE", "daily_observation", False, "level"),
    Indicator("BAMLC0A0CM", "US corporate OAS", "volatility", CATEGORIES["volatility"], "state", "daily", "percent_spread", "FRED / ICE BofA", "daily_observation", False, "bp"),
    Indicator("BAMLH0A0HYM2", "US high yield OAS", "volatility", CATEGORIES["volatility"], "state", "daily", "percent_spread", "FRED / ICE BofA", "daily_observation", False, "bp"),
    Indicator("STLFSI4", "St. Louis financial stress", "volatility", CATEGORIES["volatility"], "state", "weekly", "index", "FRED / St. Louis Fed", "observation_week", False, "level"),
    Indicator("WALCL", "Fed total assets", "liquidity", CATEGORIES["liquidity"], "state", "weekly", "usd_millions", "FRED / Federal Reserve H.4.1", "observation_week", False, "level"),
    Indicator("WRESBAL", "Reserve balances", "liquidity", CATEGORIES["liquidity"], "state", "weekly", "usd_millions", "FRED / Federal Reserve H.4.1", "observation_week", False, "level"),
    Indicator("WTREGEN", "Treasury General Account", "liquidity", CATEGORIES["liquidity"], "state", "weekly", "usd_millions", "FRED / U.S. Treasury", "observation_week", False, "level"),
    Indicator("RRPONTSYD", "Overnight reverse repo", "liquidity", CATEGORIES["liquidity"], "state", "daily", "usd_billions", "FRED / Federal Reserve Bank of New York", "daily_observation", False, "level"),
]


ALL_SERIES = {indicator.id: indicator for indicator in [*EVENT_SERIES, *STATUS_SERIES]}


def iso_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def finite_number(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(number):
        return None
    return number


def as_date(value: pd.Timestamp | str) -> str:
    return pd.Timestamp(value).strftime("%Y-%m-%d")


def parse_timestamp(value: str | None) -> pd.Timestamp | None:
    if not value:
        return None
    try:
        return pd.Timestamp(value)
    except (TypeError, ValueError):
        return None


def utc_timestamp(value: pd.Timestamp) -> pd.Timestamp:
    return value.tz_localize("UTC") if value.tzinfo is None else value.tz_convert("UTC")


def pct_change(previous: float | None, value: float | None) -> float | None:
    if previous is None or value is None or previous == 0:
        return None
    return ((value - previous) / previous) * 100


def safe_error_message(exc: Exception) -> str:
    message = str(exc)
    api_key = os.environ.get("FRED_API_KEY")
    if api_key:
        message = message.replace(api_key, "[REDACTED]")
    return message


def cache_path(series_id: str) -> Path:
    return CACHE_DIR / f"{series_id}.json"


def read_cache(series_id: str, start_date: pd.Timestamp, end_date: pd.Timestamp) -> list[dict] | None:
    if FORCE_REFRESH:
        return None
    path = cache_path(series_id)
    try:
        cached = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None

    requested_start = parse_timestamp(cached.get("requestedStartDate"))
    requested_end = parse_timestamp(cached.get("requestedEndDate"))
    fetched_at = parse_timestamp(cached.get("fetchedAt"))
    if requested_start is None or requested_end is None or fetched_at is None:
        return None
    if requested_start > start_date or requested_end < end_date:
        return None
    age_hours = (pd.Timestamp.now(tz="UTC") - utc_timestamp(fetched_at)).total_seconds() / 3600
    if age_hours > CACHE_MAX_AGE_HOURS:
        return None
    observations = cached.get("observations")
    return observations if isinstance(observations, list) else None


def write_cache(series_id: str, start_date: pd.Timestamp, end_date: pd.Timestamp, observations: list[dict]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "seriesId": series_id,
        "fetchedAt": iso_now(),
        "requestedStartDate": as_date(start_date),
        "requestedEndDate": as_date(end_date),
        "observations": observations,
    }
    cache_path(series_id).write_text(json.dumps(payload, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")


def observations_from_fred_json(payload: dict) -> list[dict]:
    rows = []
    for observation in payload.get("observations", []):
        value = finite_number(observation.get("value"))
        if value is None:
            continue
        rows.append({"date": observation.get("date"), "value": value})
    return rows


def fetch_fred_observations_via_rest(series_id: str, start_date: pd.Timestamp, end_date: pd.Timestamp) -> list[dict]:
    api_key = os.environ.get("FRED_API_KEY")
    if not api_key:
        raise RuntimeError("FRED_API_KEY is not set")

    params = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "observation_start": as_date(start_date),
        "observation_end": as_date(end_date),
    }
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = requests.get(FRED_OBSERVATIONS_URL, params=params, timeout=30)
            response.raise_for_status()
            return observations_from_fred_json(response.json())
        except Exception as exc:  # noqa: BLE001 - retried provider errors are summarized without secrets.
            last_error = exc
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"REST fallback failed for {series_id}: {safe_error_message(last_error)}")


def fetch_fred_observations(fred, series_id: str, start_date: pd.Timestamp, end_date: pd.Timestamp, failures: list[str]) -> list[dict]:
    cached = read_cache(series_id, start_date, end_date)
    if cached is not None:
        return cached
    try:
        series = fred.get_series(series_id, observation_start=as_date(start_date), observation_end=as_date(end_date))
    except Exception as exc:  # noqa: BLE001 - provider errors are surfaced as provenance.
        try:
            observations = fetch_fred_observations_via_rest(series_id, start_date, end_date)
            write_cache(series_id, start_date, end_date, observations)
            return observations
        except Exception as fallback_exc:  # noqa: BLE001
            failures.append(f"FRED {series_id}: {safe_error_message(exc)}; REST fallback: {safe_error_message(fallback_exc)}")
            return []

    series.index = pd.to_datetime(series.index)
    series = pd.to_numeric(series, errors="coerce").dropna()
    observations = [
        {"date": as_date(index), "value": finite_number(value)}
        for index, value in series.items()
        if finite_number(value) is not None
    ]
    write_cache(series_id, start_date, end_date, observations)
    return observations


def observation_frame(observations: Iterable[dict]) -> pd.DataFrame:
    rows = []
    for observation in observations:
        value = finite_number(observation.get("value"))
        if value is None:
            continue
        rows.append({"date": pd.Timestamp(observation.get("date")), "value": value})
    if not rows:
        return pd.DataFrame(columns=["value"], index=pd.DatetimeIndex([], name="date"))
    frame = pd.DataFrame(rows).dropna(subset=["date", "value"]).sort_values("date")
    frame = frame.drop_duplicates(subset=["date"], keep="last").set_index("date")
    return frame


def value_near_year_ago(frame: pd.DataFrame, date: pd.Timestamp, cadence: str) -> float | None:
    if frame.empty:
        return None
    target = date - pd.DateOffset(years=1)
    tolerance_days = 45 if cadence == "monthly" else 12 if cadence == "weekly" else 7
    candidates = frame[(frame.index <= target) & (frame.index >= target - pd.Timedelta(days=tolerance_days))]
    if candidates.empty:
        return None
    return finite_number(candidates.iloc[-1]["value"])


def event_from_point(indicator: Indicator, frame: pd.DataFrame, index: int) -> dict:
    date = frame.index[index]
    value = finite_number(frame.iloc[index]["value"])
    previous = finite_number(frame.iloc[index - 1]["value"]) if index > 0 else None
    change = None if value is None or previous is None else value - previous
    year_ago = value_near_year_ago(frame, date, indicator.cadence) if indicator.include_yoy else None
    yoy_pct = pct_change(year_ago, value) if indicator.include_yoy else None
    change_bp = change * 100 if change is not None and indicator.change_mode == "bp" else None
    return {
        "date": as_date(date),
        "seriesId": indicator.id,
        "label": indicator.label,
        "category": indicator.category,
        "categoryLabel": indicator.category_label,
        "role": indicator.role,
        "cadence": indicator.cadence,
        "unit": indicator.unit,
        "source": indicator.source,
        "dateMeaning": indicator.date_meaning,
        "actual": value,
        "previous": previous,
        "forecast": None,
        "change": change,
        "changeBp": change_bp,
        "pctChange": pct_change(previous, value),
        "yearAgo": year_ago,
        "yoyPct": yoy_pct,
        "note": indicator.note,
    }


def build_observation_events(series_frames: dict[str, pd.DataFrame]) -> list[dict]:
    events = []
    for indicator in EVENT_SERIES:
        frame = series_frames.get(indicator.id, pd.DataFrame())
        if frame.empty:
            continue
        for index, date in enumerate(frame.index):
            if WINDOW_START <= date <= END_DATE:
                events.append(event_from_point(indicator, frame, index))
    events.extend(build_fed_target_events(series_frames))
    return sorted(events, key=lambda item: (item["date"], item["category"], item["seriesId"]), reverse=True)


def build_fed_target_events(series_frames: dict[str, pd.DataFrame]) -> list[dict]:
    upper = series_frames.get("DFEDTARU", pd.DataFrame())
    lower = series_frames.get("DFEDTARL", pd.DataFrame())
    if upper.empty:
        return []
    events = []
    for index, date in enumerate(upper.index):
        if index == 0 or date < WINDOW_START or date > END_DATE:
            continue
        value = finite_number(upper.iloc[index]["value"])
        previous = finite_number(upper.iloc[index - 1]["value"])
        if value is None or previous is None or value == previous:
            continue
        lower_value = None
        if not lower.empty:
            lower_candidates = lower[lower.index <= date]
            if not lower_candidates.empty:
                lower_value = finite_number(lower_candidates.iloc[-1]["value"])
        change = value - previous
        events.append({
            "date": as_date(date),
            "seriesId": "DFEDTARU",
            "label": "Fed target range",
            "category": "rates",
            "categoryLabel": CATEGORIES["rates"],
            "role": "policy_change_observation",
            "cadence": "event",
            "unit": "percent",
            "source": "FRED / Federal Reserve",
            "dateMeaning": "daily_observation",
            "actual": value,
            "previous": previous,
            "forecast": None,
            "change": change,
            "changeBp": change * 100,
            "pctChange": pct_change(previous, value),
            "yearAgo": None,
            "yoyPct": None,
            "targetLower": lower_value,
            "note": "Derived from a change in the FRED federal funds target upper-limit series.",
        })
    return events


def stale_tolerance_days(cadence: str) -> int:
    if cadence == "daily":
        return 14
    if cadence == "weekly":
        return 21
    return 45


def weekly_window_rows(series_frames: dict[str, pd.DataFrame]) -> list[dict]:
    week_ends = pd.date_range(WINDOW_START, END_DATE, freq="W-FRI")
    if END_DATE not in week_ends and (not len(week_ends) or week_ends[-1] < END_DATE):
        week_ends = week_ends.append(pd.DatetimeIndex([END_DATE]))
    rows = []
    for week_end in week_ends:
        week_start = max(WINDOW_START, week_end - pd.Timedelta(days=6))
        values = {}
        for indicator in STATUS_SERIES:
            frame = series_frames.get(indicator.id, pd.DataFrame())
            if frame.empty:
                continue
            window = frame[(frame.index >= week_start) & (frame.index <= week_end)]
            end_candidates = frame[frame.index <= week_end]
            if end_candidates.empty:
                continue
            if window.empty:
                end_date = end_candidates.index[-1]
                stale_days = int((week_end - end_date).days)
                if stale_days > stale_tolerance_days(indicator.cadence):
                    continue
                start_date = end_date
                start_value = finite_number(end_candidates.iloc[-1]["value"])
                end_value = start_value
                change = None
                carried_forward = True
            else:
                start_date = window.index[0]
                end_date = window.index[-1]
                start_value = finite_number(window.iloc[0]["value"])
                end_value = finite_number(window.iloc[-1]["value"])
                change = None if start_value is None or end_value is None else end_value - start_value
                carried_forward = False
            values[indicator.id] = {
                "label": indicator.label,
                "category": indicator.category,
                "unit": indicator.unit,
                "source": indicator.source,
                "dateMeaning": indicator.date_meaning,
                "start": start_value,
                "end": end_value,
                "change": change,
                "changeBp": change * 100 if change is not None and indicator.change_mode == "bp" else None,
                "pctChange": pct_change(start_value, end_value),
                "observationStart": as_date(start_date),
                "observationEnd": as_date(end_date),
                "carriedForward": carried_forward,
                "staleDays": int((week_end - end_date).days),
            }
        if values:
            rows.append({
                "weekKey": as_date(week_end),
                "weekStart": as_date(week_start),
                "weekEnd": as_date(week_end),
                "values": values,
            })
    return rows


def build_summary(series_frames: dict[str, pd.DataFrame]) -> list[dict]:
    summary = []
    for indicator in [*EVENT_SERIES, *STATUS_SERIES]:
        frame = series_frames.get(indicator.id, pd.DataFrame())
        if frame.empty:
            continue
        latest = frame[frame.index <= END_DATE]
        if latest.empty:
            continue
        latest_value = finite_number(latest.iloc[-1]["value"])
        previous_value = finite_number(latest.iloc[-2]["value"]) if len(latest) > 1 else None
        change = None if latest_value is None or previous_value is None else latest_value - previous_value
        summary.append({
            "seriesId": indicator.id,
            "label": indicator.label,
            "category": indicator.category,
            "categoryLabel": indicator.category_label,
            "unit": indicator.unit,
            "latestDate": as_date(latest.index[-1]),
            "latestValue": latest_value,
            "previousValue": previous_value,
            "change": change,
            "changeBp": change * 100 if change is not None and indicator.change_mode == "bp" else None,
            "pctChange": pct_change(previous_value, latest_value),
            "source": indicator.source,
        })
    return summary


def category_summary(events: list[dict], weekly_rows: list[dict]) -> list[dict]:
    output = []
    for category, label in CATEGORIES.items():
        category_events = [event for event in events if event["category"] == category]
        latest_event = category_events[0] if category_events else None
        status_ids = [indicator.id for indicator in STATUS_SERIES if indicator.category == category]
        latest_status = None
        for row in reversed(weekly_rows):
            present = [series_id for series_id in status_ids if series_id in row["values"]]
            if present:
                latest_status = {"weekKey": row["weekKey"], "series": present}
                break
        output.append({
            "category": category,
            "label": label,
            "eventCount": len(category_events),
            "latestEventDate": latest_event["date"] if latest_event else None,
            "latestEventLabel": latest_event["label"] if latest_event else None,
            "latestStatus": latest_status,
        })
    return output


def read_existing() -> dict | None:
    try:
        return json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def build_output() -> dict:
    from fredapi import Fred

    failures: list[str] = []
    fred = Fred()
    series_frames = {}
    for series_id in ALL_SERIES:
        observations = fetch_fred_observations(fred, series_id, LOOKBACK_START, END_DATE, failures)
        series_frames[series_id] = observation_frame(observations)

    events = build_observation_events(series_frames)
    weekly_rows = weekly_window_rows(series_frames)
    summary = build_summary(series_frames)
    if not events and not weekly_rows:
        raise RuntimeError("No macro calendar rows produced")

    indicator_payload = {
        series_id: asdict(indicator)
        for series_id, indicator in ALL_SERIES.items()
    }

    return {
        "version": 1,
        "page": "macro-calendar",
        "generatedAt": iso_now(),
        "window": {
            "months": WINDOW_MONTHS,
            "startDate": as_date(WINDOW_START),
            "endDate": as_date(END_DATE),
            "lookbackStartDate": as_date(LOOKBACK_START),
        },
        "cache": {
            "providerCachePath": "tmp/macro-cache/fred",
            "maxAgeHours": CACHE_MAX_AGE_HOURS,
            "forceRefresh": FORCE_REFRESH,
        },
        "methodology": (
            "FRED observation dates are retained as observation or period dates, not public release timestamps. "
            "Forecast values are intentionally null until a reviewed forecast source or manual backend input is added. "
            "Weekly state rows summarize observed start/end changes inside each Friday-ending window."
        ),
        "categories": [{"id": key, "label": value} for key, value in CATEGORIES.items()],
        "indicators": indicator_payload,
        "summary": summary,
        "categorySummary": category_summary(events, weekly_rows),
        "events": events,
        "weeklyState": weekly_rows,
        "sources": {
            "FRED": "https://fred.stlouisfed.org/docs/api/fred/",
            "manualEvents": "Reserved for future curated policy, legal, holiday, and institutional-flow annotations.",
        },
        "failures": failures,
    }


def main() -> int:
    existing = read_existing()
    try:
        output = build_output()
    except Exception as exc:  # noqa: BLE001
        if existing:
            print(json.dumps({
                "status": "kept-last-known-good",
                "outputPath": str(OUTPUT_PATH),
                "error": str(exc),
            }, ensure_ascii=False))
            return 0
        raise

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "updated",
        "outputPath": str(OUTPUT_PATH),
        "events": len(output["events"]),
        "weeklyStateRows": len(output["weeklyState"]),
        "failures": output["failures"],
        "window": output["window"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
