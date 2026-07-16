# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable Design Decisions

- Match the reference Bitcoin cycle map: warm off-white canvas, black square grid, compact red/green heat cells, yellow halving markers, and blue time labels.
- Use semantic HTML tables for both views. Do not replace the tables with canvas, SVG, or a charting dependency.
- The crypto cycle page has two working views: a four-asset monthly rotation table and a single-asset year-by-month cycle matrix.
- Keep all market-data credentials out of the browser. The frontend reads only the cached `public/data/market-monthly.json` artifact.
- Missing pre-launch history must display as `N/A`; never fabricate historical returns.
- Keep the page title size identical across rotation and single-asset views.
- The cycle matrix shows at most the current year plus one future year; distant empty years add noise.
- Cached monthly rows include `high`, `low`, `highTime`, `lowTime`, `firstExtreme`, and `extremeMovePct`.
- Directional extreme move is `(second extreme - first extreme) / first extreme`: low-then-high is a positive potential gain; high-then-low is a negative potential loss. It is theoretical and must never be presented as realized performance.
- The macro context layer lives inside the same app as a separate event/liquidity calendar view. Keep provider credentials out of the browser; generate `public/data/macro-calendar.json` from backend scripts and cache provider observations locally under ignored `tmp/` paths to avoid repeated API calls.
- FRED observation dates are period/observation dates, not guaranteed release timestamps. Do not label them as release dates until a reviewed release-calendar or manual event source is added.
- The planned global market rotation page compares crypto, U.S., Korean, and China market sessions. Keep displayed quote units stable across language changes: crypto pairs use USDT except USDT/USD, U.S. assets use USD, Korean assets are converted to USD using the available daily FX rate, and China assets display CNY prices while market-cap fields are still normalized to USD where available.
- On the planned market rotation page, market cap is always displayed in USD. Index-level market cap may be unavailable and should show `N/A` or an explicit unavailable quality label rather than inferred values.
- If pre-market or after-hours quotes are unavailable, the planned market rotation page may show the previous regular close, but each affected value must carry a visible quality hint with hover/click detail explaining that the value is a fallback and that a better source can be added later.
- The planned market rotation page may use OKX/Binance stock or oil contracts as clearly labeled proxy prices when regular equity or commodity feeds are unavailable. Do not label exchange proxy contracts as official NYSE/Nasdaq/CME/ICE prices.
- CoinMarketCap data, if used for crypto market caps, must be fetched only by backend/local/CI scripts with `CMC_PRO_API_KEY` read from environment or an ignored local env file. Never expose a CMC key through `VITE_*` variables or frontend bundles.
- Do not use TradingView as a scraped data source. Only use TradingView market data if there is an official API/data agreement that permits the intended public display and caching.
- The fifth page for AI chip-chain hotspots should prioritize a fine-grained category + ticker heat board over a single all-in-one physical teardown diagram. Keep A-shares out of the MVP page, include Korean equities such as `005930.KS` and `000660.KS`, and show sample/live quote source quality visibly until reviewed backend market-data feeds are connected.
- On the chip-chain hotspot page, do not visually segment tickers by listing market such as U.S., Korea, Hong Kong, or A-share. Keep the user-facing scan centered on supply-chain category, ticker, price movement, mini price path, and pinned detail.
- The chip-chain mini price path is acceptable as a prototype placeholder only. Before production release, replace it with backend-cached real price series for the selected window, such as open-to-now for `1D` and window-open-to-now for `5D`, `1M`, and `3M`.
- The chip-chain market-data pipeline must run only through backend/local/CI scripts such as `scripts/update-chip-chain-data.mjs`. Do not add browser-side provider calls or expose Alpaca, KIS, KRX, or other market-data credentials to frontend code.
- Treat `generatedAt` as a transformation timestamp only, never as a source-observation timestamp. Dataset manifests and UI freshness audits must keep `observedAt`, `fetchedAt`, `transformedAt`, `deployedAt`, and `clientCheckedAt` distinct.
- The market-clock page must consume backend-generated absolute status intervals from reviewed official NYSE, KRX, SSE, and SZSE calendars and trading rules. Holiday, weekend, early-close, and next-transition logic belongs in the backend cache; the frontend only selects the current interval and renders its countdown.
- Chip-chain sample or pending assets must never affect category averages, leaders, or hotspot rankings. Preserve them only in a separate pending-integration watchlist until a reviewed production quote adapter replaces them.
- Keep product routes behind lazy page boundaries. Large optional datasets such as `chart-series.json` must load only after the route's first-screen data is available, so optional visualizations cannot block the page shell and summary.
- Keep `npm run check` healthy as the local quality gate; it covers source linting, unit tests, official market-calendar boundaries, and the production build.
- The crypto-liquidity 30D/90D/1Y controls must be backed by retained backend/database observations at the selected daily or weekly cadence. Derive period changes from those retained observations when the provider omits them; never synthesize, interpolate, or silently zero-fill missing dates.
- ETF fund flow and corporate-treasury demand history must communicate signed magnitude and direction with a readable time-series treatment, not color-only traffic-light blocks. Render missing observations as neutral grey/empty gaps (including discontinuous lines) so absence is never mistaken for zero activity.
- For China market rotation, distinguish the 15:00 regular close, the 15:00-15:05 order-entry/no-match gap, and the 15:05-15:30 after-hours fixed-price phase. From 2026-07-06 the reviewed SSE/SZSE rules extend this close-price, time-priority phase to A-shares and exchange-traded open-end funds; do not label it as continuous regular trading or apply it on days/securities that are ineligible. SSE50/CSI500 rows are non-tradable index proxies and must not inherit a tradable fixed-price status.
