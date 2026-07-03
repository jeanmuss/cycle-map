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
import html as html_lib
import re
import sys
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import pandas as pd
import requests

APP_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = APP_ROOT.parent
OUTPUT_PATH = APP_ROOT / "public" / "data" / "macro-calendar.json"
CACHE_DIR = WORKSPACE_ROOT / "tmp" / "macro-cache" / "fred"
SCHEDULE_CACHE_DIR = WORKSPACE_ROOT / "tmp" / "macro-cache" / "official-schedules"
FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"
FRED_RELEASE_DATES_URL = "https://api.stlouisfed.org/fred/release/dates"
FRED_EMPLOYMENT_SITUATION_RELEASE_ID = 50
FRED_CPI_RELEASE_ID = 10
FED_FOMC_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
ADP_NER_JSON_URL = "https://adpemploymentreport.com/ner_production.json"
US_FEDERAL_HOLIDAYS_URL = "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/"

WINDOW_MONTHS = int(os.environ.get("MACRO_CALENDAR_MONTHS", "6"))
CACHE_MAX_AGE_HOURS = float(os.environ.get("MACRO_CACHE_MAX_AGE_HOURS", "18"))
SCHEDULE_CACHE_MAX_AGE_HOURS = float(os.environ.get("MACRO_SCHEDULE_CACHE_MAX_AGE_HOURS", "18"))
FORCE_REFRESH = os.environ.get("MACRO_CACHE_REFRESH", "").strip().lower() in {"1", "true", "yes"}
MANUAL_ONLY = os.environ.get("MACRO_MANUAL_ONLY", "").strip().lower() in {"1", "true", "yes"}
MANUAL_EVENT_LOOKAHEAD_DAYS = int(os.environ.get("MACRO_MANUAL_EVENT_LOOKAHEAD_DAYS", "120"))
SCHEDULE_EVENT_LOOKAHEAD_DAYS = int(os.environ.get("MACRO_SCHEDULE_EVENT_LOOKAHEAD_DAYS", "120"))
DEFAULT_END_DATE = pd.Timestamp(datetime.now(UTC).date())
END_DATE = pd.Timestamp(os.environ.get("MACRO_CALENDAR_END_DATE", DEFAULT_END_DATE.strftime("%Y-%m-%d")))
WINDOW_START = (END_DATE - pd.DateOffset(months=WINDOW_MONTHS)).normalize()
LOOKBACK_START = (WINDOW_START - pd.DateOffset(years=1, days=14)).normalize()
MANUAL_EVENT_END = (END_DATE + pd.DateOffset(days=MANUAL_EVENT_LOOKAHEAD_DAYS)).normalize()
SCHEDULE_EVENT_END = (END_DATE + pd.DateOffset(days=SCHEDULE_EVENT_LOOKAHEAD_DAYS)).normalize()

try:
    EASTERN_TZ = ZoneInfo("America/New_York")
    BEIJING_TZ = ZoneInfo("Asia/Shanghai")
except ZoneInfoNotFoundError:
    EASTERN_TZ = timezone(timedelta(hours=-5))
    BEIJING_TZ = timezone(timedelta(hours=8))

MONTH_NUMBER = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


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


MANUAL_EVENTS: list[dict] = [
    {
        "date": "2026-07-20",
        "seriesId": "MANUAL_FIFA_WC_FINAL_2026",
        "label": "世界杯决赛 / FIFA World Cup Final",
        "category": "liquidity",
        "categoryLabel": CATEGORIES["liquidity"],
        "role": "manual_liquidity_event",
        "cadence": "event",
        "unit": "event",
        "source": "FIFA match schedule / manual liquidity annotation",
        "dateMeaning": "scheduled_beijing_date",
        "actual": None,
        "previous": None,
        "forecast": None,
        "change": None,
        "changeBp": None,
        "pctChange": None,
        "yearAgo": None,
        "yoyPct": None,
        "note": "Scheduled for 2026-07-19 15:00 America/New_York at New York New Jersey Stadium; Beijing time is 2026-07-20 03:00. Added as a discretionary liquidity/attention event, not an economic data release.",
    },
]

CHINA_PUBLIC_HOLIDAY_ANCHORS: dict[int, list[tuple[str, str, str, str]]] = {
    2026: [
        ("2026-02-17", "China Spring Festival holiday", "Spring Festival", "春节"),
        ("2026-04-05", "China Qingming Festival holiday", "Qingming Festival", "清明节"),
        ("2026-05-01", "China Labor Day holiday", "Labor Day", "劳动节"),
        ("2026-06-19", "China Dragon Boat Festival holiday", "Dragon Boat Festival", "端午节"),
        ("2026-09-25", "China Mid-Autumn Festival holiday", "Mid-Autumn Festival", "中秋节"),
        ("2026-10-01", "China National Day holiday", "National Day", "国庆节"),
    ],
}


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


def schedule_cache_path(cache_key: str) -> Path:
    safe_key = re.sub(r"[^a-zA-Z0-9_.-]+", "-", cache_key).strip("-")
    return SCHEDULE_CACHE_DIR / f"{safe_key}.html"


def read_text_cache(cache_key: str) -> str | None:
    if FORCE_REFRESH:
        return None
    path = schedule_cache_path(cache_key)
    try:
        cached = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    fetched_at = parse_timestamp(cached.get("fetchedAt"))
    if fetched_at is None:
        return None
    age_hours = (pd.Timestamp.now(tz="UTC") - utc_timestamp(fetched_at)).total_seconds() / 3600
    if age_hours > SCHEDULE_CACHE_MAX_AGE_HOURS:
        return None
    text = cached.get("text")
    return text if isinstance(text, str) else None


def write_text_cache(cache_key: str, source_url: str, text: str) -> None:
    SCHEDULE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "sourceUrl": source_url,
        "fetchedAt": iso_now(),
        "text": text,
    }
    schedule_cache_path(cache_key).write_text(json.dumps(payload, ensure_ascii=True) + "\n", encoding="utf-8")


def fetch_official_schedule_text(cache_key: str, source_url: str, failures: list[str]) -> str | None:
    cached = read_text_cache(cache_key)
    if cached is not None:
        return cached
    try:
        response = requests.get(source_url, timeout=30, headers={"User-Agent": "cycle-map-market-calendar/1.0"})
        response.raise_for_status()
        text = response.text
        write_text_cache(cache_key, source_url, text)
        return text
    except Exception as exc:  # noqa: BLE001 - schedule source failures are reported without secrets.
        failures.append(f"Official schedule {cache_key}: {safe_error_message(exc)}")
        return cached


def fetch_fred_release_dates(release_id: int, failures: list[str]) -> list[pd.Timestamp]:
    cache_key = f"fred-release-dates-{release_id}"
    cached = read_text_cache(cache_key)
    text = cached
    if text is None:
        api_key = os.environ.get("FRED_API_KEY")
        if not api_key:
            failures.append(f"FRED release dates {release_id}: FRED_API_KEY is not set")
            return []
        params = {
            "release_id": release_id,
            "api_key": api_key,
            "file_type": "json",
            "include_release_dates_with_no_data": "true",
            "sort_order": "desc",
            "limit": 120,
        }
        try:
            response = requests.get(FRED_RELEASE_DATES_URL, params=params, timeout=30)
            response.raise_for_status()
            text = response.text
            write_text_cache(cache_key, f"{FRED_RELEASE_DATES_URL}?release_id={release_id}", text)
        except Exception as exc:  # noqa: BLE001 - provider errors are summarized without secrets.
            failures.append(f"FRED release dates {release_id}: {safe_error_message(exc)}")
            return []

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        failures.append(f"FRED release dates {release_id}: invalid cached JSON ({safe_error_message(exc)})")
        return []

    dates = []
    for item in payload.get("release_dates", []):
        try:
            dates.append(pd.Timestamp(item.get("date")))
        except (TypeError, ValueError):
            continue
    return sorted(set(dates))


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


def plain_text_from_html(html_text: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", html_text)
    text = re.sub(r"(?s)<[^>]+>", "\n", text)
    text = html_lib.unescape(text)
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


def fred_release_timestamp(release_date: pd.Timestamp, hour: int = 8, minute: int = 30) -> datetime:
    return datetime(release_date.year, release_date.month, release_date.day, hour, minute, tzinfo=EASTERN_TZ)


def beijing_release_date(release_time_eastern: datetime) -> pd.Timestamp:
    return pd.Timestamp(release_time_eastern.astimezone(BEIJING_TZ).date())


def release_time_payload(release_time_eastern: datetime) -> dict:
    utc_time = release_time_eastern.astimezone(UTC).replace(microsecond=0)
    beijing_time = release_time_eastern.astimezone(BEIJING_TZ).replace(microsecond=0)
    return {
        "releaseTimeUtc": utc_time.isoformat().replace("+00:00", "Z"),
        "releaseTimeBeijing": beijing_time.isoformat(),
    }


def latest_value_for_series(series_frames: dict[str, pd.DataFrame], series_id: str) -> float | None:
    frame = series_frames.get(series_id, pd.DataFrame())
    if frame.empty:
        return None
    latest = frame[frame.index <= END_DATE]
    if latest.empty:
        return None
    return finite_number(latest.iloc[-1]["value"])


def latest_change_for_series(series_frames: dict[str, pd.DataFrame], series_id: str) -> float | None:
    frame = series_frames.get(series_id, pd.DataFrame())
    if frame.empty:
        return None
    latest = frame[frame.index <= END_DATE]
    if len(latest) < 2:
        return None
    current = finite_number(latest.iloc[-1]["value"])
    previous = finite_number(latest.iloc[-2]["value"])
    if current is None or previous is None:
        return None
    return current - previous


def latest_pct_change_for_series(series_frames: dict[str, pd.DataFrame], series_id: str) -> float | None:
    frame = series_frames.get(series_id, pd.DataFrame())
    if frame.empty:
        return None
    latest = frame[frame.index <= END_DATE]
    if len(latest) < 2:
        return None
    return pct_change(finite_number(latest.iloc[-2]["value"]), finite_number(latest.iloc[-1]["value"]))


def latest_yoy_for_series(series_frames: dict[str, pd.DataFrame], series_id: str) -> float | None:
    frame = series_frames.get(series_id, pd.DataFrame())
    if frame.empty:
        return None
    latest = frame[frame.index <= END_DATE]
    if latest.empty:
        return None
    latest_date = latest.index[-1]
    latest_value = finite_number(latest.iloc[-1]["value"])
    year_ago = value_near_year_ago(frame, latest_date, "monthly")
    return pct_change(year_ago, latest_value)


def scheduled_event(
    *,
    date: pd.Timestamp,
    series_id: str,
    label: str,
    category: str,
    unit: str,
    source: str,
    previous: float | None,
    release_time_eastern: datetime,
    reference_period: str | None = None,
    note: str = "",
    target_lower: float | None = None,
) -> dict:
    payload = {
        "date": as_date(date),
        "seriesId": series_id,
        "label": label,
        "category": category,
        "categoryLabel": CATEGORIES[category],
        "role": "scheduled_release",
        "cadence": "event",
        "unit": unit,
        "source": source,
        "dateMeaning": "scheduled_beijing_date",
        "actual": None,
        "previous": previous,
        "forecast": None,
        "change": None,
        "changeBp": None,
        "pctChange": None,
        "yearAgo": None,
        "yoyPct": None,
        "note": note,
        **release_time_payload(release_time_eastern),
    }
    if reference_period:
        payload["referencePeriod"] = reference_period
    if target_lower is not None:
        payload["targetLower"] = target_lower
    return payload


def in_schedule_window(date: pd.Timestamp) -> bool:
    return END_DATE < date <= SCHEDULE_EVENT_END


def in_event_window(date: pd.Timestamp) -> bool:
    return WINDOW_START <= date <= MANUAL_EVENT_END


def parse_jobs_to_thousands(value: str | None) -> float | None:
    if not value:
        return None
    match = re.search(r"-?[\d,]+", str(value))
    if not match:
        return None
    try:
        return int(match.group(0).replace(",", "")) / 1000
    except ValueError:
        return None


def adp_report_release_time(payload: dict) -> datetime | None:
    for value in [payload.get("reportDownloadLink"), payload.get("reportPressReleaseLink")]:
        match = re.search(r"/(20\d{6})/", str(value or ""))
        if match:
            stamp = match.group(1)
            return datetime(int(stamp[:4]), int(stamp[4:6]), int(stamp[6:8]), 8, 15, tzinfo=EASTERN_TZ)
    try:
        month = month_number(str(payload.get("reportMonth") or ""))
        year = int(payload.get("reportYear"))
    except (TypeError, ValueError):
        return None
    if month is None:
        return None
    return datetime(year, month, 1, 8, 15, tzinfo=EASTERN_TZ)


def build_adp_report_events(failures: list[str]) -> list[dict]:
    text = fetch_official_schedule_text("adp-ner-production-json", ADP_NER_JSON_URL, failures)
    if not text:
        return []
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        failures.append(f"ADP National Employment Report: invalid JSON ({safe_error_message(exc)})")
        return []

    release_time = adp_report_release_time(payload)
    if release_time is None:
        failures.append("ADP National Employment Report: release date is unavailable")
        return []
    date = beijing_release_date(release_time)
    if not in_event_window(date):
        return []

    cards = payload.get("reportOverview", {}).get("cards", [])
    employment_card = next((card for card in cards if card.get("metricName") == "Employment Change"), None)
    actual = parse_jobs_to_thousands((employment_card or {}).get("metricValue"))
    reference_period = " ".join(
        part for part in [str(payload.get("reportMonth") or "").strip(), str(payload.get("reportYear") or "").strip()]
        if part
    ) or None

    return [{
        "date": as_date(date),
        "seriesId": f"ADP_PRIVATE_PAYROLLS_{as_date(date)}",
        "label": "ADP private payrolls",
        "category": "growth",
        "categoryLabel": CATEGORIES["growth"],
        "role": "external_release",
        "cadence": "monthly",
        "unit": "thousand_persons",
        "source": "ADP National Employment Report",
        "dateMeaning": "scheduled_beijing_date",
        "actual": actual,
        "previous": None,
        "forecast": None,
        "change": None,
        "changeBp": None,
        "pctChange": None,
        "yearAgo": None,
        "yoyPct": None,
        "referencePeriod": reference_period,
        "note": "Latest ADP National Employment Report from ADP's public static NER JSON. Actual is converted from jobs to thousands of persons for display consistency.",
        "sourceUrl": ADP_NER_JSON_URL,
        "pressReleaseUrl": payload.get("reportPressReleaseLink"),
        **release_time_payload(release_time),
    }]


def nth_weekday(year: int, month: int, weekday: int, n: int) -> datetime:
    date = datetime(year, month, 1, tzinfo=EASTERN_TZ)
    offset = (weekday - date.weekday()) % 7
    return date + timedelta(days=offset + (n - 1) * 7)


def last_weekday(year: int, month: int, weekday: int) -> datetime:
    if month == 12:
        date = datetime(year + 1, 1, 1, tzinfo=EASTERN_TZ) - timedelta(days=1)
    else:
        date = datetime(year, month + 1, 1, tzinfo=EASTERN_TZ) - timedelta(days=1)
    return date - timedelta(days=(date.weekday() - weekday) % 7)


def observed_holiday(date: datetime) -> datetime:
    if date.weekday() == 5:
        return date - timedelta(days=1)
    if date.weekday() == 6:
        return date + timedelta(days=1)
    return date


def us_holiday_payload(label: str, holiday_name: str, holiday_name_zh: str, legal_date: datetime) -> dict:
    observed_date = observed_holiday(legal_date)
    return {
        "observed": observed_date,
        "legalDate": as_date(pd.Timestamp(legal_date.date())),
        "label": label,
        "holidayName": holiday_name,
        "holidayNameZh": holiday_name_zh,
    }


def us_federal_holidays(year: int) -> list[dict]:
    return [
        us_holiday_payload("U.S. New Year's Day holiday", "New Year's Day", "新年", datetime(year, 1, 1, tzinfo=EASTERN_TZ)),
        us_holiday_payload("U.S. Martin Luther King Jr. Day holiday", "Martin Luther King Jr. Day", "马丁路德金日", nth_weekday(year, 1, 0, 3)),
        us_holiday_payload("U.S. Washington's Birthday holiday", "Washington's Birthday", "华盛顿诞辰日", nth_weekday(year, 2, 0, 3)),
        us_holiday_payload("U.S. Memorial Day holiday", "Memorial Day", "阵亡将士纪念日", last_weekday(year, 5, 0)),
        us_holiday_payload("U.S. Juneteenth holiday", "Juneteenth", "六月节", datetime(year, 6, 19, tzinfo=EASTERN_TZ)),
        us_holiday_payload("U.S. Independence Day holiday", "Independence Day", "独立日", datetime(year, 7, 4, tzinfo=EASTERN_TZ)),
        us_holiday_payload("U.S. Labor Day holiday", "Labor Day", "劳工节", nth_weekday(year, 9, 0, 1)),
        us_holiday_payload("U.S. Columbus Day holiday", "Columbus Day", "哥伦布日", nth_weekday(year, 10, 0, 2)),
        us_holiday_payload("U.S. Veterans Day holiday", "Veterans Day", "退伍军人节", datetime(year, 11, 11, tzinfo=EASTERN_TZ)),
        us_holiday_payload("U.S. Thanksgiving Day holiday", "Thanksgiving Day", "感恩节", nth_weekday(year, 11, 3, 4)),
        us_holiday_payload("U.S. Christmas Day holiday", "Christmas Day", "圣诞节", datetime(year, 12, 25, tzinfo=EASTERN_TZ)),
    ]


def build_us_holiday_events() -> list[dict]:
    events: list[dict] = []
    for year in range(WINDOW_START.year, MANUAL_EVENT_END.year + 1):
        for holiday in us_federal_holidays(year):
            date = pd.Timestamp(holiday["observed"].date())
            if not in_event_window(date):
                continue
            observed_date = as_date(date)
            legal_date = holiday["legalDate"]
            holiday_name = holiday["holidayName"]
            holiday_name_zh = holiday["holidayNameZh"]
            if observed_date != legal_date:
                note = (
                    f"{holiday_name} is legally dated {legal_date} and observed on {observed_date} under "
                    "standard OPM weekend-observance rules. It is a liquidity/market-attention annotation, "
                    "not an economic data release."
                )
            else:
                note = (
                    f"{holiday_name} is observed on {observed_date} under standard OPM federal holiday rules. "
                    "It is a liquidity/market-attention annotation, not an economic data release."
                )
            events.append({
                "date": observed_date,
                "seriesId": f"US_FEDERAL_HOLIDAY_{observed_date}",
                "label": holiday["label"],
                "category": "liquidity",
                "categoryLabel": CATEGORIES["liquidity"],
                "role": "holiday",
                "cadence": "event",
                "unit": "event",
                "country": "US",
                "holidayName": holiday_name,
                "holidayNameZh": holiday_name_zh,
                "observedDate": observed_date,
                "legalDate": legal_date,
                "timezone": "America/New_York",
                "source": "OPM federal holiday calendar / U.S. federal holiday rules",
                "dateMeaning": "observed_holiday_date",
                "actual": None,
                "previous": None,
                "forecast": None,
                "change": None,
                "changeBp": None,
                "pctChange": None,
                "yearAgo": None,
                "yoyPct": None,
                "note": note,
            })
    return events


def build_china_holiday_events() -> list[dict]:
    events: list[dict] = []
    for year in range(WINDOW_START.year, MANUAL_EVENT_END.year + 1):
        for date_text, label, holiday_name, holiday_name_zh in CHINA_PUBLIC_HOLIDAY_ANCHORS.get(year, []):
            date = pd.Timestamp(date_text)
            if not in_event_window(date):
                continue
            observed_date = as_date(date)
            events.append({
                "date": observed_date,
                "seriesId": f"CN_PUBLIC_HOLIDAY_{observed_date}",
                "label": label,
                "category": "liquidity",
                "categoryLabel": CATEGORIES["liquidity"],
                "role": "holiday",
                "cadence": "event",
                "unit": "event",
                "country": "CN",
                "holidayName": holiday_name,
                "holidayNameZh": holiday_name_zh,
                "observedDate": observed_date,
                "legalDate": observed_date,
                "timezone": "Asia/Shanghai",
                "source": "Manual China holiday festival-date annotation",
                "dateMeaning": "observed_holiday_date",
                "actual": None,
                "previous": None,
                "forecast": None,
                "change": None,
                "changeBp": None,
                "pctChange": None,
                "yearAgo": None,
                "yoyPct": None,
                "note": (
                    f"{holiday_name} festival-date anchor for {observed_date}. "
                    "This annotation marks the festival date for liquidity attention; the full adjusted public-holiday range is not modeled."
                ),
            })
    return events


def build_bls_scheduled_events(series_frames: dict[str, pd.DataFrame], failures: list[str]) -> list[dict]:
    events: list[dict] = []
    for release_date in fetch_fred_release_dates(FRED_EMPLOYMENT_SITUATION_RELEASE_ID, failures):
        release_time = fred_release_timestamp(release_date)
        date = beijing_release_date(release_time)
        if not in_schedule_window(date):
            continue
        source = "FRED release dates / BLS Employment Situation"
        events.append(scheduled_event(
            date=date,
            series_id=f"PAYEMS_SCHEDULED_{as_date(date)}",
            label="Nonfarm payrolls",
            category="growth",
            unit="thousand_persons",
            source=source,
            previous=latest_change_for_series(series_frames, "PAYEMS"),
            release_time_eastern=release_time,
            note="Scheduled release date from FRED's official release-date endpoint for the BLS Employment Situation; previous value is the latest month-over-month payroll change derived from FRED observations.",
        ))
        events.append(scheduled_event(
            date=date,
            series_id=f"UNRATE_SCHEDULED_{as_date(date)}",
            label="Unemployment rate",
            category="growth",
            unit="percent",
            source=source,
            previous=latest_value_for_series(series_frames, "UNRATE"),
            release_time_eastern=release_time,
            note="Scheduled release date from FRED's official release-date endpoint for the BLS Employment Situation; previous value is the latest FRED observation available at generation time.",
        ))

    for release_date in fetch_fred_release_dates(FRED_CPI_RELEASE_ID, failures):
        release_time = fred_release_timestamp(release_date)
        date = beijing_release_date(release_time)
        if not in_schedule_window(date):
            continue
        source = "FRED release dates / BLS CPI"
        events.append(scheduled_event(
            date=date,
            series_id=f"CPI_MOM_SCHEDULED_{as_date(date)}",
            label="CPI monthly inflation rate",
            category="inflation",
            unit="percent",
            source=source,
            previous=latest_pct_change_for_series(series_frames, "CPIAUCSL"),
            release_time_eastern=release_time,
            note="Scheduled release date from FRED's official release-date endpoint for CPI; previous value is derived from latest FRED CPI index observations.",
        ))
        events.append(scheduled_event(
            date=date,
            series_id=f"CPI_YOY_SCHEDULED_{as_date(date)}",
            label="CPI yearly inflation rate",
            category="inflation",
            unit="percent",
            source=source,
            previous=latest_yoy_for_series(series_frames, "CPIAUCSL"),
            release_time_eastern=release_time,
            note="Scheduled release date from FRED's official release-date endpoint for CPI; previous value is derived from latest FRED CPI index observations.",
        ))
    return events


def month_number(label: str) -> int | None:
    return MONTH_NUMBER.get(label.strip().lower().rstrip("."))


def parse_fomc_meetings(html_text: str) -> list[datetime]:
    lines = plain_text_from_html(html_text).splitlines()
    meetings: list[datetime] = []
    active_year: int | None = None
    current_month_label: str | None = None

    for raw_line in lines:
        line = raw_line.strip().replace("*", "")
        year_match = re.search(r"\b(20\d{2})\s+FOMC\s+Meetings\b", line, re.IGNORECASE)
        if year_match:
            active_year = int(year_match.group(1))
            current_month_label = None
            continue
        if active_year is None:
            continue
        if re.search(r"\b(20\d{2})\s+FOMC\s+Meetings\b", line, re.IGNORECASE):
            continue
        if re.fullmatch(r"[A-Za-z]{3,9}(?:/[A-Za-z]{3,9})?", line):
            current_month_label = line
            continue
        if current_month_label is None:
            continue
        date_match = re.fullmatch(r"(\d{1,2})(?:-(\d{1,2}))?", line)
        if not date_match:
            continue

        month_parts = current_month_label.split("/")
        start_month = month_number(month_parts[0])
        if start_month is None:
            continue
        start_day = int(date_match.group(1))
        end_day = int(date_match.group(2) or date_match.group(1))
        end_month = start_month
        end_year = active_year
        if len(month_parts) > 1:
            end_month = month_number(month_parts[-1]) or start_month
        elif end_day < start_day:
            end_month += 1
            if end_month == 13:
                end_month = 1
                end_year += 1
        meetings.append(datetime(end_year, end_month, end_day, 14, 0, tzinfo=EASTERN_TZ))

    return meetings


def build_fomc_scheduled_events(series_frames: dict[str, pd.DataFrame], failures: list[str]) -> list[dict]:
    html_text = fetch_official_schedule_text("fed-fomc-calendar", FED_FOMC_CALENDAR_URL, failures)
    if not html_text:
        return []

    events: list[dict] = []
    target_upper = latest_value_for_series(series_frames, "DFEDTARU")
    target_lower = latest_value_for_series(series_frames, "DFEDTARL")
    for decision_time in parse_fomc_meetings(html_text):
        decision_date = beijing_release_date(decision_time)
        if in_schedule_window(decision_date):
            events.append(scheduled_event(
                date=decision_date,
                series_id=f"FOMC_RATE_DECISION_SCHEDULED_{as_date(decision_date)}",
                label="FOMC rate decision",
                category="rates",
                unit="percent",
                source="Federal Reserve FOMC calendar",
                previous=target_upper,
                target_lower=target_lower,
                release_time_eastern=decision_time,
                note="Scheduled FOMC policy decision. Previous value displays the latest target upper bound; targetLower carries the latest lower bound.",
            ))

        minutes_time = decision_time + timedelta(days=21)
        minutes_date = beijing_release_date(minutes_time)
        if in_schedule_window(minutes_date):
            events.append(scheduled_event(
                date=minutes_date,
                series_id=f"FOMC_MINUTES_SCHEDULED_{as_date(minutes_date)}",
                label="FOMC meeting minutes",
                category="rates",
                unit="event",
                source="Federal Reserve FOMC calendar",
                previous=None,
                release_time_eastern=minutes_time,
                note="Federal Reserve notes that minutes of regularly scheduled meetings are released three weeks after the policy decision.",
            ))
    return events


def build_scheduled_events(series_frames: dict[str, pd.DataFrame], failures: list[str]) -> list[dict]:
    events = [
        *build_adp_report_events(failures),
        *build_bls_scheduled_events(series_frames, failures),
        *build_fomc_scheduled_events(series_frames, failures),
        *build_us_holiday_events(),
        *build_china_holiday_events(),
    ]
    return sorted(events, key=lambda item: (item["date"], item["category"], item["seriesId"]), reverse=True)


def merge_scheduled_events(events: list[dict], scheduled_events: list[dict]) -> list[dict]:
    scheduled_keys = {(event["seriesId"], event["date"]) for event in scheduled_events}
    kept_events = [
        event for event in events
        if (event.get("seriesId"), event.get("date")) not in scheduled_keys
    ]
    return sorted([*kept_events, *scheduled_events], key=lambda item: (item["date"], item["category"], item["seriesId"]), reverse=True)


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


def manual_events_for_window() -> list[dict]:
    events = []
    for event in MANUAL_EVENTS:
        date = pd.Timestamp(event["date"])
        if WINDOW_START <= date <= MANUAL_EVENT_END:
            events.append(dict(event))
    return events


def merge_manual_events(events: list[dict]) -> list[dict]:
    manual_events = manual_events_for_window()
    manual_keys = {(event["seriesId"], event["date"]) for event in manual_events}
    kept_events = [
        event for event in events
        if (event.get("seriesId"), event.get("date")) not in manual_keys
    ]
    return sorted([*kept_events, *manual_events], key=lambda item: (item["date"], item["category"], item["seriesId"]), reverse=True)


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

    scheduled_events = build_scheduled_events(series_frames, failures)
    events = merge_manual_events(merge_scheduled_events(build_observation_events(series_frames), scheduled_events))
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
            "officialScheduleCachePath": "tmp/macro-cache/official-schedules",
            "maxAgeHours": CACHE_MAX_AGE_HOURS,
            "scheduleMaxAgeHours": SCHEDULE_CACHE_MAX_AGE_HOURS,
            "forceRefresh": FORCE_REFRESH,
            "manualEventLookaheadDays": MANUAL_EVENT_LOOKAHEAD_DAYS,
            "scheduleEventLookaheadDays": SCHEDULE_EVENT_LOOKAHEAD_DAYS,
        },
        "methodology": (
            "FRED observation dates are retained as observation or period dates, not public release timestamps. "
            "Future BLS scheduled release rows come from the official FRED release-date API; FOMC rows come from the Federal Reserve calendar and use Beijing dates. "
            "Holiday rows use U.S. federal observed-date rules plus manual China festival-date annotations. "
            "Scheduled rows leave actual and forecast null until a reviewed forecast source or released observation is available. "
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
            "FRED release dates": "https://fred.stlouisfed.org/docs/api/fred/release_dates.html",
            "Federal Reserve FOMC calendar": FED_FOMC_CALENDAR_URL,
            "ADP National Employment Report": ADP_NER_JSON_URL,
            "U.S. federal holidays": US_FEDERAL_HOLIDAYS_URL,
            "China holiday annotations": "Manual festival-date annotations maintained in scripts/update-macro-calendar.py.",
            "manualEvents": "Curated policy, legal, holiday, media, sports, and institutional-flow annotations maintained in scripts/update-macro-calendar.py.",
        },
        "failures": failures,
    }


def merge_manual_events_into_existing(existing: dict, error: Exception | None = None) -> dict:
    output = dict(existing)
    failures = [
        failure for failure in list(output.get("failures") or [])
        if "manual events merged into last-known-good cache" not in str(failure)
    ]
    scheduled_events = build_scheduled_events({}, failures)
    events = merge_manual_events(merge_scheduled_events(list(output.get("events") or []), scheduled_events))
    output["events"] = events
    output["generatedAt"] = iso_now()
    output["categorySummary"] = category_summary(events, list(output.get("weeklyState") or []))
    output.setdefault("cache", {})["manualEventLookaheadDays"] = MANUAL_EVENT_LOOKAHEAD_DAYS
    output.setdefault("cache", {})["scheduleEventLookaheadDays"] = SCHEDULE_EVENT_LOOKAHEAD_DAYS
    output.setdefault("cache", {})["officialScheduleCachePath"] = "tmp/macro-cache/official-schedules"
    output.setdefault("sources", {})["manualEvents"] = (
        "Curated policy, legal, holiday, media, sports, and institutional-flow annotations maintained in scripts/update-macro-calendar.py."
    )
    output.setdefault("sources", {})["FRED release dates"] = "https://fred.stlouisfed.org/docs/api/fred/release_dates.html"
    output.setdefault("sources", {})["Federal Reserve FOMC calendar"] = FED_FOMC_CALENDAR_URL
    output.setdefault("sources", {})["ADP National Employment Report"] = ADP_NER_JSON_URL
    output.setdefault("sources", {})["U.S. federal holidays"] = US_FEDERAL_HOLIDAYS_URL
    output.setdefault("sources", {})["China holiday annotations"] = "Manual festival-date annotations maintained in scripts/update-macro-calendar.py."
    if error is not None:
        failures.append(f"FRED refresh skipped; manual events merged into last-known-good cache: {safe_error_message(error)}")
    output["failures"] = failures
    return output


def main() -> int:
    existing = read_existing()
    if MANUAL_ONLY:
        if not existing:
            raise RuntimeError("MACRO_MANUAL_ONLY requires an existing macro-calendar.json")
        output = merge_manual_events_into_existing(existing)
        OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "status": "merged-manual-events",
            "outputPath": str(OUTPUT_PATH),
            "events": len(output["events"]),
        }, ensure_ascii=False))
        return 0

    try:
        output = build_output()
    except Exception as exc:  # noqa: BLE001
        if existing:
            output = merge_manual_events_into_existing(existing, exc)
            OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps({
                "status": "merged-manual-events-into-last-known-good",
                "outputPath": str(OUTPUT_PATH),
                "error": str(exc),
                "events": len(output["events"]),
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
