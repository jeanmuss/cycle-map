#!/usr/bin/env python
"""Build the static daily equity-macro calendar cache for the frontend.

Security posture:
- Runs only as a backend/local/CI script.
- Reads provider credentials from environment variables only; never writes them to output.
- Stores a six-month derived daily calendar plus minimal local provider caches.
- Preserves the existing last-known-good JSON when a critical fetch fails.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import Callable
from zoneinfo import ZoneInfo

import pandas as pd

APP_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = APP_ROOT.parent
OUTPUT_PATH = APP_ROOT / "public" / "data" / "equity-weekly.json"
CACHE_DIR = WORKSPACE_ROOT / "tmp" / "equity-cache"
SHARED_FRED_CACHE_DIR = WORKSPACE_ROOT / "tmp" / "macro-cache" / "fred"

NY_TZ = ZoneInfo("America/New_York")
WINDOW_MONTHS = int(os.environ.get("EQUITY_CALENDAR_MONTHS", "6"))
PRICE_SOURCE = os.environ.get("EQUITY_PRICE_SOURCE", "akshare").strip().lower()
CACHE_MAX_AGE_MINUTES = int(os.environ.get("EQUITY_CACHE_MAX_AGE_MINUTES", "55"))
END_DATE = pd.Timestamp(os.environ.get("EQUITY_CALENDAR_END_DATE", datetime.now(NY_TZ).date().isoformat())).normalize()
WINDOW_START = (END_DATE - pd.DateOffset(months=WINDOW_MONTHS)).normalize()
LOOKBACK_START = (WINDOW_START - pd.DateOffset(days=10)).normalize()

ASSETS = {
    "QQQ": {
        "symbol": "QQQ",
        "displaySymbol": "QQQ",
        "name": "Invesco QQQ Trust",
        "role": "Nasdaq 100 proxy",
        "quote": "USD",
    },
    "SPY": {
        "symbol": "SPY",
        "displaySymbol": "SPY",
        "name": "SPDR S&P 500 ETF Trust",
        "role": "S&P 500 proxy",
        "quote": "USD",
    },
    "DIA": {
        "symbol": "DIA",
        "displaySymbol": "DOW",
        "name": "SPDR Dow Jones Industrial Average ETF Trust",
        "role": "Dow Jones Industrial Average ETF proxy",
        "quote": "USD",
    },
}

FRED_SERIES = {
    "DGS10": {"label": "10Y Treasury", "unit": "percent", "kind": "yield"},
    "VIXCLS": {"label": "VIX", "unit": "index", "kind": "volatility"},
}


@dataclass
class DailyPrices:
    symbol: str
    source: str
    frame: pd.DataFrame
    cache_status: str


def iso_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_existing() -> dict | None:
    try:
        return json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def finite_number(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(number):
        return None
    return number


def pct_change(open_value: float | None, close_value: float | None) -> float | None:
    if open_value is None or close_value is None or open_value == 0:
        return None
    return ((close_value - open_value) / open_value) * 100


def observed_fixed_holiday(year: int, month: int, day: int) -> date:
    holiday = date(year, month, day)
    if holiday.weekday() == 5:
        return holiday - timedelta(days=1)
    if holiday.weekday() == 6:
        return holiday + timedelta(days=1)
    return holiday


def nth_weekday(year: int, month: int, weekday: int, occurrence: int) -> date:
    current = date(year, month, 1)
    offset = (weekday - current.weekday()) % 7
    return current + timedelta(days=offset + (occurrence - 1) * 7)


def last_weekday(year: int, month: int, weekday: int) -> date:
    current = (date(year, month, 1) + pd.offsets.MonthEnd(0)).date()
    offset = (current.weekday() - weekday) % 7
    return current - timedelta(days=offset)


def easter_date(year: int) -> date:
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def nyse_holidays(year: int) -> set[date]:
    holidays = {
        observed_fixed_holiday(year, 1, 1),
        nth_weekday(year, 1, 0, 3),
        nth_weekday(year, 2, 0, 3),
        easter_date(year) - timedelta(days=2),
        last_weekday(year, 5, 0),
        observed_fixed_holiday(year, 7, 4),
        nth_weekday(year, 9, 0, 1),
        nth_weekday(year, 11, 3, 4),
        observed_fixed_holiday(year, 12, 25),
    }
    if year >= 2022:
        holidays.add(observed_fixed_holiday(year, 6, 19))
    return holidays


def is_market_day(day: pd.Timestamp) -> bool:
    as_date = day.date()
    if day.weekday() >= 5:
        return False
    holiday_years = {as_date.year - 1, as_date.year, as_date.year + 1}
    holidays = set().union(*(nyse_holidays(year) for year in holiday_years))
    return as_date not in holidays


def market_status(now: datetime | None = None) -> dict:
    now = now or datetime.now(NY_TZ)
    today = pd.Timestamp(now.date())
    market_day = is_market_day(today)
    open_time = datetime.combine(now.date(), time(9, 30), NY_TZ)
    close_time = datetime.combine(now.date(), time(16, 0), NY_TZ)
    is_open = market_day and open_time <= now <= close_time
    return {
        "timezone": "America/New_York",
        "date": now.date().isoformat(),
        "isMarketDay": market_day,
        "isOpen": is_open,
        "session": "open" if is_open else "closed",
        "refreshCadence": "hourly while U.S. equity markets are open; otherwise last close",
    }


def cache_is_fresh(path: Path, status: dict) -> bool:
    if not path.exists():
        return False
    modified = datetime.fromtimestamp(path.stat().st_mtime, UTC)
    age = datetime.now(UTC) - modified
    if status["isOpen"]:
        return age <= timedelta(minutes=CACHE_MAX_AGE_MINUTES)
    return modified.astimezone(NY_TZ).date().isoformat() == status["date"]


def normalize_price_frame(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.rename(columns={column: str(column).lower().replace(" ", "_") for column in frame.columns})
    if "date" in frame.columns:
        frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
        frame = frame.dropna(subset=["date"]).set_index("date")
    frame.index = pd.to_datetime(frame.index).tz_localize(None).normalize()
    for column in ["open", "high", "low", "close", "volume"]:
        if column not in frame.columns:
            frame[column] = None
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame[["open", "high", "low", "close", "volume"]].dropna(subset=["open", "close"]).sort_index()
    return frame


def read_price_cache(symbol: str) -> DailyPrices | None:
    path = CACHE_DIR / f"price-{symbol}.csv"
    meta_path = CACHE_DIR / f"price-{symbol}.json"
    if not path.exists():
        return None
    try:
        frame = pd.read_csv(path, parse_dates=["date"]).set_index("date")
        frame = normalize_price_frame(frame)
        meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
        return DailyPrices(symbol=symbol, source=meta.get("source", "local price cache"), frame=frame, cache_status="cache")
    except Exception:
        return None


def write_price_cache(prices: DailyPrices) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    frame = prices.frame.reset_index().rename(columns={"index": "date"})
    frame.to_csv(CACHE_DIR / f"price-{prices.symbol}.csv", index=False)
    (CACHE_DIR / f"price-{prices.symbol}.json").write_text(
        json.dumps({"source": prices.source, "fetchedAt": iso_now()}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def source_akshare_daily(symbol: str) -> DailyPrices:
    import akshare as ak

    frame = ak.stock_us_daily(symbol=symbol, adjust="")
    if frame.empty:
        raise RuntimeError(f"AKShare returned no rows for {symbol}")
    frame = normalize_price_frame(frame)
    return DailyPrices(symbol=symbol, source="AKShare / Sina US stock daily (unadjusted)", frame=frame, cache_status="fresh")


def source_yfinance_daily(symbol: str) -> DailyPrices:
    import yfinance as yf

    cache_dir = WORKSPACE_ROOT / "tmp" / "yfinance-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    if hasattr(yf, "set_tz_cache_location"):
        yf.set_tz_cache_location(str(cache_dir))
    frame = yf.download(
        symbol,
        start=LOOKBACK_START.strftime("%Y-%m-%d"),
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False,
        timeout=20,
    )
    if frame.empty:
        raise RuntimeError(f"yfinance returned no rows for {symbol}")
    if isinstance(frame.columns, pd.MultiIndex):
        frame.columns = [str(col[0]).lower().replace(" ", "_") for col in frame.columns]
    else:
        frame.columns = [str(col).lower().replace(" ", "_") for col in frame.columns]
    frame = normalize_price_frame(frame)
    return DailyPrices(symbol=symbol, source="yfinance daily (unadjusted close)", frame=frame, cache_status="fresh")


def fetch_daily_prices(symbol: str, failures: list[str], status: dict) -> DailyPrices:
    cached = read_price_cache(symbol)
    if cached and cache_is_fresh(CACHE_DIR / f"price-{symbol}.csv", status):
        cached.frame = cached.frame[cached.frame.index >= LOOKBACK_START]
        return cached

    providers: dict[str, Callable[[str], DailyPrices]] = {
        "akshare": source_akshare_daily,
        "yfinance": source_yfinance_daily,
    }
    ordered = [PRICE_SOURCE] + [name for name in providers if name != PRICE_SOURCE]
    last_error: Exception | None = None
    for provider_name in ordered:
        provider = providers.get(provider_name)
        if provider is None:
            continue
        try:
            result = provider(symbol)
            result.frame = result.frame[result.frame.index >= LOOKBACK_START]
            if result.frame.empty:
                raise RuntimeError(f"{provider_name} has no rows after {LOOKBACK_START.date()}")
            write_price_cache(result)
            return result
        except Exception as exc:  # noqa: BLE001 - provider failures become cache provenance.
            last_error = exc
            failures.append(f"{symbol} {provider_name}: {exc}")

    if cached:
        cached.frame = cached.frame[cached.frame.index >= LOOKBACK_START]
        cached.cache_status = "stale-cache"
        failures.append(f"{symbol}: using stale local price cache after provider failure")
        return cached
    raise RuntimeError(f"No price source produced data for {symbol}: {last_error}")


def fred_cache_path(series_id: str) -> Path:
    return CACHE_DIR / f"fred-{series_id}.json"


def read_fred_cache(series_id: str) -> pd.Series | None:
    for path in [fred_cache_path(series_id), SHARED_FRED_CACHE_DIR / f"{series_id}.json"]:
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            rows = payload.get("observations", [])
            series = pd.Series({row["date"]: row["value"] for row in rows})
            series.index = pd.to_datetime(series.index)
            return pd.to_numeric(series, errors="coerce").dropna()
        except Exception:
            continue
    return None


def write_fred_cache(series_id: str, series: pd.Series) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    rows = [
        {"date": index.strftime("%Y-%m-%d"), "value": finite_number(value)}
        for index, value in series.sort_index().items()
        if finite_number(value) is not None
    ]
    fred_cache_path(series_id).write_text(
        json.dumps({"seriesId": series_id, "fetchedAt": iso_now(), "observations": rows}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def fetch_fred_series(failures: list[str], status: dict) -> dict[str, pd.Series]:
    from fredapi import Fred

    output: dict[str, pd.Series] = {}
    fred: Fred | None = None
    for series_id in FRED_SERIES:
        cached = read_fred_cache(series_id)
        if cached is not None and cache_is_fresh(fred_cache_path(series_id), status):
            output[series_id] = cached[cached.index >= LOOKBACK_START]
            continue
        try:
            fred = fred or Fred()
            series = fred.get_series(series_id, observation_start=LOOKBACK_START.strftime("%Y-%m-%d"))
            series.index = pd.to_datetime(series.index)
            series = pd.to_numeric(series, errors="coerce").dropna()
            write_fred_cache(series_id, series)
            output[series_id] = series
        except Exception as exc:  # noqa: BLE001
            failures.append(f"FRED {series_id}: {exc}")
            if cached is not None:
                output[series_id] = cached[cached.index >= LOOKBACK_START]
                failures.append(f"FRED {series_id}: using stale local cache")
    return output


def macro_observation(series: pd.Series | None, date_key: str) -> dict | None:
    if series is None or series.empty:
        return None
    target = pd.Timestamp(date_key)
    available = series[series.index <= target]
    if available.empty:
        return None
    end_date = available.index[-1]
    end_value = finite_number(available.iloc[-1])
    previous = series[series.index < end_date]
    start_date = previous.index[-1] if not previous.empty else None
    start_value = finite_number(previous.iloc[-1]) if not previous.empty else None
    change = None if end_value is None or start_value is None else end_value - start_value
    return {
        "date": end_date.strftime("%Y-%m-%d"),
        "value": end_value,
        "previous": start_value,
        "change": change,
        "changeBp": None if change is None else change * 100,
        "carriedForward": end_date.strftime("%Y-%m-%d") != date_key,
    }


def daily_asset_row(frame: pd.DataFrame, date_key: str, symbol: str) -> dict | None:
    target = pd.Timestamp(date_key)
    if target not in frame.index:
        return None
    row = frame.loc[target]
    open_value = finite_number(row.get("open"))
    close_value = finite_number(row.get("close"))
    return {
        "symbol": symbol,
        "date": date_key,
        "open": open_value,
        "high": finite_number(row.get("high")),
        "low": finite_number(row.get("low")),
        "close": close_value,
        "price": close_value,
        "pct": pct_change(open_value, close_value),
        "volume": finite_number(row.get("volume")),
        "priceType": "close",
    }


def parse_spot_number(row: pd.Series, candidates: list[str]) -> float | None:
    normalized = {str(key).lower().replace(" ", "").replace("_", ""): key for key in row.index}
    for candidate in candidates:
        key = normalized.get(candidate.lower().replace(" ", "").replace("_", ""))
        if key is not None:
            value = finite_number(row.get(key))
            if value is not None:
                return value
    return None


def fetch_delayed_spot_quotes(failures: list[str]) -> dict[str, dict]:
    try:
        import akshare as ak

        frame = ak.stock_us_spot_em()
    except Exception as exc:  # noqa: BLE001
        failures.append(f"AKShare delayed spot: {exc}")
        return {}
    if frame.empty:
        return {}
    symbols = set(ASSETS)
    output = {}
    for _, row in frame.iterrows():
        row_text = " ".join(str(value).upper() for value in row.values)
        matched = next((symbol for symbol in symbols if symbol in row_text), None)
        if not matched:
            continue
        price = parse_spot_number(row, ["最新价", "price", "latest", "最新"])
        open_value = parse_spot_number(row, ["今开", "open"])
        previous = parse_spot_number(row, ["昨收", "previous close", "prevclose", "昨收价"])
        pct = parse_spot_number(row, ["涨跌幅", "pct", "changepercent"])
        output[matched] = {
            "symbol": matched,
            "price": price,
            "open": open_value,
            "previousClose": previous,
            "pct": pct,
            "source": "AKShare / Eastmoney US delayed spot",
            "asOf": iso_now(),
        }
    return output


def build_latest_assets(days: list[dict], spot_quotes: dict[str, dict], status: dict) -> dict[str, dict | None]:
    latest = {}
    for symbol in ASSETS:
        daily = next((day["assets"].get(symbol) for day in reversed(days) if day["assets"].get(symbol)), None)
        quote = spot_quotes.get(symbol)
        if quote and quote.get("price") is not None and status["isOpen"]:
            base_open = quote.get("open") or (daily.get("open") if daily else None)
            latest[symbol] = {
                **(daily or {"symbol": symbol}),
                "price": quote["price"],
                "close": quote["price"],
                "open": base_open,
                "pct": quote.get("pct") if quote.get("pct") is not None else pct_change(base_open, quote["price"]),
                "priceType": "delayed",
                "source": quote.get("source"),
                "asOf": quote.get("asOf"),
            }
        else:
            latest[symbol] = daily
    return latest


def day_range() -> list[pd.Timestamp]:
    return list(pd.date_range(WINDOW_START, END_DATE, freq="D"))


def build_output() -> dict:
    failures: list[str] = []
    status = market_status()
    price_daily = {symbol: fetch_daily_prices(symbol, failures, status) for symbol in ASSETS}
    fred_daily = fetch_fred_series(failures, status)
    spot_quotes = fetch_delayed_spot_quotes(failures) if status["isOpen"] else {}

    days = []
    for day in day_range():
        date_key = day.strftime("%Y-%m-%d")
        market_day = is_market_day(day)
        assets = {
            symbol: daily_asset_row(prices.frame, date_key, symbol)
            for symbol, prices in price_daily.items()
        }
        macro = {
            series_id: macro_observation(fred_daily.get(series_id), date_key) if market_day else None
            for series_id in FRED_SERIES
        }
        days.append({
            "date": date_key,
            "dayOfWeek": int(day.weekday()),
            "isMarketDay": market_day,
            "assets": assets if market_day else {symbol: None for symbol in ASSETS},
            "macro": macro if market_day else {series_id: None for series_id in FRED_SERIES},
        })

    trading_days = [day for day in days if day["isMarketDay"] and any(day["assets"].values())]
    if not trading_days:
        raise RuntimeError("No daily equity rows produced")

    latest_assets = build_latest_assets(trading_days, spot_quotes, status)
    latest_macro_date = trading_days[-1]["date"]
    latest_macro = {
        series_id: macro_observation(fred_daily.get(series_id), latest_macro_date)
        for series_id in FRED_SERIES
    }

    return {
        "version": 2,
        "page": "equity-macro",
        "timezone": "America/New_York for trading dates; FRED observations use provider dates",
        "generatedAt": iso_now(),
        "window": {
            "months": WINDOW_MONTHS,
            "startDate": WINDOW_START.strftime("%Y-%m-%d"),
            "endDate": END_DATE.strftime("%Y-%m-%d"),
        },
        "market": status,
        "methodology": (
            "Daily price rows are derived from cached daily OHLC for QQQ, SPY, and DIA. "
            "DIA is used as a Dow Jones Industrial Average ETF proxy. "
            "10Y and VIX use FRED daily observations and display latest observation changes versus the previous observation."
        ),
        "priceSourcePreference": PRICE_SOURCE,
        "failures": failures,
        "assets": {
            symbol: {
                **ASSETS[symbol],
                "sourceLabel": price_daily[symbol].source,
                "cacheStatus": price_daily[symbol].cache_status,
                "rows": len(price_daily[symbol].frame),
                "firstDate": price_daily[symbol].frame.index[0].strftime("%Y-%m-%d"),
                "lastDate": price_daily[symbol].frame.index[-1].strftime("%Y-%m-%d"),
            }
            for symbol in ASSETS
        },
        "macroSeries": FRED_SERIES,
        "sources": {
            "prices": "AKShare/Sina US daily by default; yfinance remains a local fallback. Delayed AKShare/Eastmoney spot is used only during market hours when reachable.",
            "FRED": "https://fred.stlouisfed.org/docs/api/fred/",
            "calendar": "Built-in NYSE holiday rules for regular full market closures; early closes are not modeled in this version.",
            "cache": "tmp/equity-cache",
        },
        "latest": {
            "date": trading_days[-1]["date"],
            "assets": latest_assets,
            "macro": latest_macro,
        },
        "days": days,
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
        "days": len(output["days"]),
        "failures": output["failures"],
        "lastDate": output["latest"]["date"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
