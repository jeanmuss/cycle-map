# Risk Asset Cycle Map

Interactive return tables for risk assets:

- Crypto cycle map: monthly BTC, ETH, SOL, and HYPE returns.
- Equity macro map: weekly QQQ/SPY relative strength with FRED macro context from January 20, 2025 onward.
- Event and liquidity calendar: six-month macro, rates, dollar, volatility, and credit context.
- Global market clock: crypto, U.S., Korea, and China market-session rotation with prices, market caps where available, and source-quality labels.
- AI chip-chain hotspots: supply-chain category rotation with ticker-level price paths and a pinned detail panel.

The interface follows the visual and technical idea of the original Bitcoin four-year cycle map: semantic HTML tables, CSS heat classes, and JavaScript-driven calculations.

## Commands

```bash
npm run dev
npm run build
npm run update-data
npm run update-market-session
npm run update-chip-chain
npm run update-equity-data
npm run update-macro-calendar
```

## Data flow

`scripts/update-market-data.mjs` retrieves public monthly data and writes a normalized static cache to `public/data/market-monthly.json`. The browser only reads that cache and never receives provider credentials.

- BTC: Blockchain.info market-price chart for the established open/close series; Binance Spot daily candles provide exchange highs/lows and their order from 2017 onward
- ETH and SOL: Binance Spot daily candles
- HYPE: Hyperliquid daily candles

If an upstream source fails, the updater preserves the last-known-good cached asset. The checked-in JSON lets the site continue working during an outage. Once directional history has been backfilled, later updates request only the latest two months instead of downloading the full history again.

The monthly return formula is `(close - open) / open * 100%`. For the still-open current month, `close` is replaced by the latest cached spot price so the current-month return does not stay stuck on yesterday's daily candle.

The directional extreme move is `(second extreme - first extreme) / first extreme * 100%`: low-before-high produces a positive potential gain, while high-before-low produces a negative potential loss. Daily candles establish the order; only same-day collisions are refined with hourly and then one-minute public candles. UTC month boundaries are used throughout.

Current spot prices are fetched by the backend/CI updater and cached into the same static JSON:

- BTC, ETH, and SOL: Binance Spot ticker, with multiple public endpoint fallbacks.
- HYPE: Hyperliquid public mid price.

This keeps the frontend free of provider credentials and avoids browser-side scraping. The GitHub Pages workflow refreshes the deployed static cache hourly; GitHub's scheduler can run a few minutes late, so this is near-hourly rather than tick-level realtime.

Hyperliquid's public API exposes the HYPE launch month as a monthly candle but does not retain intramonth candles for that month. Its high and low remain visible, while the directional extreme move is explicitly cached as unavailable instead of being inferred.

`scripts/update-equity-data.py` retrieves weekly equity-macro data and writes `public/data/equity-weekly.json`.

- QQQ and SPY: AKShare/Sina U.S. daily data by default, grouped into Friday-ending weeks. `EQUITY_PRICE_SOURCE=yfinance` can be used when Yahoo access is healthy.
- FRED: `DGS10`, `VIXCLS`, and `DFF`, read with `FRED_API_KEY` from the local environment or deployment secrets.
- Events: the `events` array is reserved in each weekly row, but no automatic event source or editor is enabled yet.

Only derived weekly data is cached. API keys, cookies, sessions, raw tick data, and personal data are never written to frontend files.

`scripts/update-market-session-data.mjs` retrieves the fourth-page market-session snapshot and writes `public/data/market-session.json`.

- Crypto prices: OKX public spot tickers for BTC/USDT, BNB/USDT, HYPE/USDT, and USDT/USD.
- Crypto market caps: CoinMarketCap `quotes/latest`, read with `CMC_PRO_API_KEY` from local environment or deployment secrets.
- U.S. proxy prices: OKX public equity-swap tickers for TSLA, NVDA, and MSFT when an official U.S. equity feed is not connected.
- CL proxy: OKX CL index ticker with index component metadata; it is labeled as a proxy, not as an official CME/ICE price.
- Korea and China rows: session clocks are generated locally; price and market-cap fields remain `N/A` until reviewed sources are connected.

The browser reads only the generated JSON. `CMC_PRO_API_KEY` must never be exposed through `VITE_*` variables or frontend code.

`scripts/update-chip-chain-data.mjs` retrieves the fifth-page chip-chain market cache and writes `public/data/chip-chain-hotspots.json`.

- U.S. equities, ETFs, and ADRs: Alpaca official stock bars via backend/CI, using `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY` from local ignored env files or GitHub Actions secrets.
- Feed selection: set `CHIP_CHAIN_US_FEED` to `iex` by default, or to `delayed_sip` / `sip` only when the account subscription and redistribution terms support it.
- Price paths: `1D`, `5D`, `1M`, and `3M` are written as static `pricePaths` and the frontend draws those paths when present.
- Korea rows: Samsung Electronics `005930.KS` and SK hynix `000660.KS` remain in the page, but the KIS/KRX adapter is pending reviewed credentials, licensing, and redistribution terms. Until then those rows keep their visible sample/static source quality.

If Alpaca credentials are not configured, the updater keeps the last-known-good JSON and does not rewrite `generatedAt`. A commit or deploy does not automatically convert sample chip-chain data into live market data; provider credentials and reviewed adapters must be configured first.

`scripts/update-macro-calendar.py` retrieves the first macro-calendar source set and writes `public/data/macro-calendar.json`.

- Inflation: CPI, core CPI, PPI, core PPI goods, PCE, and core PCE from FRED.
- Employment and growth: nonfarm payrolls, unemployment, average hourly earnings, initial claims, retail sales, industrial production, real GDP, and consumer sentiment from FRED.
- Rates and dollar: Fed target range, effective fed funds, 2Y/10Y Treasury yields, 10Y real yield, 10Y breakeven, broad USD index, USD/JPY, USD/CNY, Japan overnight rates, China 3M interbank rates, and FOMC SEP fed funds projections from FRED.
- Volatility and credit: VIX, investment-grade OAS, high-yield OAS, and St. Louis Fed financial stress index from FRED.
- Liquidity and balance sheet: M2, Federal Reserve total assets, reserve balances, Treasury General Account, and overnight reverse repo from FRED.

The script caches provider observations under `tmp/macro-cache/fred` before generating the public JSON. `tmp/` is ignored by git, so local reruns avoid repeated API calls without committing provider cache files. By default the provider cache is reused for 18 hours; set `MACRO_CACHE_REFRESH=1` to force a refresh, `MACRO_CALENDAR_MONTHS=6` to adjust the output window, or `MACRO_CACHE_MAX_AGE_HOURS=...` to tune local reuse.

FRED observation dates are retained as economic observation/period dates, not publication timestamps. Forecast values stay `null` until a reviewed forecast source or manual backend input is added. This avoids presenting period dates or unreviewed consensus numbers as release-calendar facts.

Curated manual events live in `scripts/update-macro-calendar.py` and are merged into `macro-calendar.json` alongside FRED observations. These are discretionary liquidity or attention annotations, not economic data releases.

For CI or deployment, install Python dependencies with:

```bash
python -m pip install -r requirements-equity.txt
```

On GitHub Actions, store `FRED_API_KEY` in repository secrets. Do not put it in `.env`, frontend code, checked-in JSON, logs, screenshots, or chat.

## Deployment notes

GitHub Pages is the preferred static-share path for this repo. `.github/workflows/deploy-pages.yml` builds the Vite app, refreshes the crypto cache, uploads `app/dist`, and deploys it on:

- every push to `main`
- manual workflow dispatch
- an hourly schedule for current spot, market-session, and configured chip-chain refreshes

Hourly Pages refreshes do not create hourly commits. The separate `update-market-data.yml` workflow can still be used for auditable checked-in cache updates on a lower-frequency schedule, including macro-calendar and chip-chain cache files.

The repository root includes `vercel.json` for Vercel preview deployments from this workspace:

- install: `npm --prefix app ci`
- build: `npm --prefix app run build`
- output: `app/dist`
- SPA rewrite: all routes fall back to `index.html`, so `/equity-macro` can be opened directly.

The frontend is intentionally static. It should not call FRED, CoinMarketCap, AKShare, Yahoo, or any other provider from the browser. Scheduled backend/CI jobs refresh checked-in JSON caches, and the deployed site serves those static cache files.

For mainland China users, treat Vercel as the first preview host, not the only production host. If real-user testing shows unstable access, the same `app/dist` build can be mirrored to a China-friendly static host such as Alibaba Cloud OSS + CDN or Tencent Cloud COS + CDN. No data relay is required as long as the browser continues to read only static JSON.
