#!/usr/bin/env python
"""Build the fast static indicator cache for the U.S. market page.

Security posture:
- Runs only as a backend/local/CI script.
- Reads CMC and FRED credentials from environment variables or ignored local
  env files; never writes credentials to output.
- Writes only bounded derived indicators for the frontend.
- Preserves last-known-good values when a provider is unavailable.
"""

from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

APP_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = APP_ROOT.parent
OUTPUT_PATH = APP_ROOT / "public" / "data" / "equity-fast.json"
SLOW_EQUITY_PATH = APP_ROOT / "public" / "data" / "equity-weekly.json"

CMC_QUOTES_URL = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest"
CMC_GLOBAL_URL = "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest"
FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"
GOLD_SERIES_ID = "NASDAQQGLDI"
REFRESH_CADENCE = "Target 15 minutes for fast indicators; provider schedules and static deployment queues can add delay."


def iso_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except (TypeError, ValueError):
        try:
            return datetime.fromisoformat(f"{value}T00:00:00+00:00")
        except (TypeError, ValueError):
            return None


def oldest_timestamp(values: list[str | None]) -> str | None:
    parsed = [timestamp for value in values if (timestamp := parse_timestamp(value)) is not None]
    return min(parsed).isoformat().replace("+00:00", "Z") if parsed else None


def load_env_file(path: Path) -> None:
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return
    for line in text.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", trimmed)
        if not match or os.environ.get(match.group(1)):
            continue
        value = match.group(2).strip()
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        os.environ[match.group(1)] = value


def safe_error_message(error: Exception) -> str:
    output = str(error)
    for secret in [os.environ.get("CMC_PRO_API_KEY"), os.environ.get("FRED_API_KEY")]:
        if secret:
            output = output.replace(secret, "[REDACTED]")
    return output


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def finite_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def pct_change(previous: float | None, current: float | None) -> float | None:
    if previous is None or current is None or previous == 0:
        return None
    return ((current - previous) / previous) * 100


def fetch_json(url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "cycle-map-equity-fast-cache/1.0",
            **(headers or {}),
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310 - reviewed provider URLs only.
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset))


def cached_metric(existing: dict[str, Any] | None, metric_id: str) -> dict[str, Any] | None:
    if not existing:
        return None
    for metric in existing.get("metrics", []):
        if metric.get("id") == metric_id:
            return metric
    return None


def metric(
    metric_id: str,
    label: str,
    value: float | None,
    unit: str,
    source_label: str,
    source_url: str,
    as_of: str | None,
    change_pct: float | None = None,
    previous: float | None = None,
    quality: str = "fresh",
) -> dict[str, Any]:
    return {
        "id": metric_id,
        "label": label,
        "value": value,
        "unit": unit,
        "previous": previous,
        "changePct": change_pct,
        "asOf": as_of,
        "sourceLabel": source_label,
        "sourceUrl": source_url,
        "quality": quality,
    }


def fetch_btc_market_cap() -> dict[str, Any]:
    key = os.environ.get("CMC_PRO_API_KEY")
    if not key:
        raise RuntimeError("CMC_PRO_API_KEY is not configured")
    params = urllib.parse.urlencode({"id": "1", "convert": "USD"})
    payload = fetch_json(f"{CMC_QUOTES_URL}?{params}", {"X-CMC_PRO_API_KEY": key})
    data = payload.get("data", {})
    row = data.get("1") or data.get(1)
    if isinstance(row, list):
        row = row[0] if row else None
    quote = (row or {}).get("quote", {}).get("USD", {})
    value = finite_number(quote.get("market_cap"))
    if value is None:
        raise RuntimeError("CMC BTC market cap is unavailable")
    return metric(
        "BTC_MARKET_CAP",
        "BTC market cap",
        value,
        "USD",
        "CoinMarketCap cryptocurrency quotes/latest",
        CMC_QUOTES_URL,
        quote.get("last_updated") or (row or {}).get("last_updated"),
        finite_number(quote.get("percent_change_24h")),
    )


def fetch_crypto_market_cap() -> dict[str, Any]:
    key = os.environ.get("CMC_PRO_API_KEY")
    if not key:
        raise RuntimeError("CMC_PRO_API_KEY is not configured")
    params = urllib.parse.urlencode({"convert": "USD"})
    payload = fetch_json(f"{CMC_GLOBAL_URL}?{params}", {"X-CMC_PRO_API_KEY": key})
    quote = payload.get("data", {}).get("quote", {}).get("USD", {})
    value = finite_number(quote.get("total_market_cap"))
    if value is None:
        raise RuntimeError("CMC total crypto market cap is unavailable")
    return metric(
        "CRYPTO_MARKET_CAP",
        "Total crypto market cap",
        value,
        "USD",
        "CoinMarketCap global-metrics/quotes/latest",
        CMC_GLOBAL_URL,
        quote.get("last_updated") or payload.get("status", {}).get("timestamp"),
        finite_number(quote.get("total_market_cap_yesterday_percentage_change")),
        finite_number(quote.get("total_market_cap_yesterday")),
    )


def fetch_gold_price() -> dict[str, Any]:
    key = os.environ.get("FRED_API_KEY")
    if not key:
        raise RuntimeError("FRED_API_KEY is not configured")
    params = urllib.parse.urlencode({
        "series_id": GOLD_SERIES_ID,
        "api_key": key,
        "file_type": "json",
        "sort_order": "desc",
        "limit": "8",
    })
    payload = fetch_json(f"{FRED_OBSERVATIONS_URL}?{params}")
    observations = [
        row for row in payload.get("observations", [])
        if row.get("value") not in {None, "."} and finite_number(row.get("value")) is not None
    ]
    if not observations:
        raise RuntimeError("FRED gold observations are unavailable")
    latest = observations[0]
    previous_row = observations[1] if len(observations) > 1 else None
    value = finite_number(latest.get("value"))
    previous = finite_number(previous_row.get("value")) if previous_row else None
    return metric(
        "GOLD_PRICE_PROXY",
        "Gold price proxy",
        value,
        "index",
        "FRED / Credit Suisse NASDAQ Gold FLOWS103 Price Index",
        "https://fred.stlouisfed.org/series/NASDAQQGLDI",
        latest.get("date"),
        pct_change(previous, value),
        previous,
    )


def fallback_metric(existing: dict[str, Any] | None, metric_id: str, failure: str) -> dict[str, Any]:
    cached = cached_metric(existing, metric_id)
    if cached and finite_number(cached.get("value")) is not None:
        return {
            **cached,
            "fetchedAt": cached.get("fetchedAt") or (existing.get("timestamps") or {}).get("fetchedAt") or existing.get("generatedAt"),
            "quality": "last-known-good",
            "failure": failure,
        }
    defaults = {
        "BTC_MARKET_CAP": ("BTC market cap", "USD", "CoinMarketCap cryptocurrency quotes/latest", CMC_QUOTES_URL),
        "CRYPTO_MARKET_CAP": ("Total crypto market cap", "USD", "CoinMarketCap global-metrics/quotes/latest", CMC_GLOBAL_URL),
        "GOLD_PRICE_PROXY": ("Gold price proxy", "index", "FRED / Credit Suisse NASDAQ Gold FLOWS103 Price Index", "https://fred.stlouisfed.org/series/NASDAQQGLDI"),
    }
    label, unit, source_label, source_url = defaults[metric_id]
    return {
        **metric(metric_id, label, None, unit, source_label, source_url, None, quality="unavailable"),
        "failure": failure,
    }


def main() -> int:
    load_env_file(APP_ROOT / ".env.local")
    load_env_file(WORKSPACE_ROOT / ".env.local")

    existing = read_json(OUTPUT_PATH)
    slow_equity = read_json(SLOW_EQUITY_PATH) or {}
    failures: list[str] = []
    metrics: list[dict[str, Any]] = []
    fetchers = {
        "BTC_MARKET_CAP": fetch_btc_market_cap,
        "CRYPTO_MARKET_CAP": fetch_crypto_market_cap,
        "GOLD_PRICE_PROXY": fetch_gold_price,
    }

    for metric_id, fetcher in fetchers.items():
        try:
            fresh_metric = fetcher()
            fresh_metric["fetchedAt"] = iso_now()
            metrics.append(fresh_metric)
        except Exception as exc:  # noqa: BLE001 - provider failures are reported without secrets.
            message = safe_error_message(exc)
            failures.append(f"{metric_id}: {message}")
            metrics.append(fallback_metric(existing, metric_id, message))

    transformed_at = iso_now()
    output = {
        "version": 1,
        "page": "equity-fast",
        "generatedAt": transformed_at,
        "timestamps": {
            "observedAt": oldest_timestamp([item.get("asOf") for item in metrics if item.get("value") is not None]),
            "fetchedAt": oldest_timestamp([item.get("fetchedAt") for item in metrics if item.get("value") is not None]),
            "transformedAt": transformed_at,
        },
        "refreshCadence": REFRESH_CADENCE,
        "baseDataset": {
            "file": "equity-weekly.json",
            "timestamps": slow_equity.get("timestamps") or {"transformedAt": slow_equity.get("generatedAt")},
        },
        "methodology": (
            "Fast indicators are generated separately from the slower equity calendar cache. "
            "CMC supplies crypto market capitalization; FRED supplies a gold price proxy index because the old LBMA gold fix series is not available in the current FRED API. "
            "The frontend reads this static derived JSON and never receives provider credentials."
        ),
        "metrics": metrics,
        "sources": {
            "CoinMarketCap": "https://coinmarketcap.com/api/documentation/v1/",
            "FRED": "https://fred.stlouisfed.org/docs/api/fred/",
            "Gold proxy": "https://fred.stlouisfed.org/series/NASDAQQGLDI",
        },
        "failures": failures,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "updated",
        "outputPath": str(OUTPUT_PATH),
        "metrics": len(metrics),
        "failures": len(failures),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
