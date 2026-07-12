const DAY_MS = 86_400_000;

export const CRYPTO_LIQUIDITY_VERSION = 1;
export const CRYPTO_LIQUIDITY_HISTORY_DAYS = 400;

export function finiteNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function quoteUsd(row) {
  const quote = row?.quote;
  if (Array.isArray(quote)) return quote.find((item) => item?.symbol === "USD") || quote[0] || {};
  return quote?.USD || {};
}

function cmcRow(payload, id) {
  const data = payload?.data;
  if (Array.isArray(data)) return data.find((row) => String(row?.id) === String(id)) || null;
  const row = data?.[id] ?? data?.[String(id)] ?? null;
  return Array.isArray(row) ? row[0] || null : row;
}

function metric(id, label, labelZh, value, unit, observedAt, source, extra = {}) {
  return {
    id,
    label,
    labelZh,
    value: finiteNumber(value),
    unit,
    observedAt: observedAt || null,
    source,
    ...extra,
  };
}

export function normalizeCmcLiquidity(globalPayload, quotesPayload) {
  const globalQuote = globalPayload?.data?.quote?.USD || {};
  const btcRow = cmcRow(quotesPayload, 1);
  const usdtRow = cmcRow(quotesPayload, 825);
  const usdcRow = cmcRow(quotesPayload, 3408);
  const btcQuote = quoteUsd(btcRow);
  const usdtQuote = quoteUsd(usdtRow);
  const usdcQuote = quoteUsd(usdcRow);
  const source = "cmc";
  const totalMarketCap = finiteNumber(globalQuote.total_market_cap);
  const btcMarketCap = finiteNumber(btcQuote.market_cap);
  const usdtMarketCap = finiteNumber(usdtQuote.market_cap);
  const usdcMarketCap = finiteNumber(usdcQuote.market_cap);
  const trackedStablecoinMarketCap = [usdtMarketCap, usdcMarketCap].every((value) => value != null)
    ? usdtMarketCap + usdcMarketCap
    : null;

  return [
    metric("crypto.totalMarketCap", "Total crypto market cap", "加密市场总市值", totalMarketCap, "USD", globalQuote.last_updated || globalPayload?.status?.timestamp, source, {
      changePct24h: finiteNumber(globalQuote.total_market_cap_yesterday_percentage_change),
      semantics: "market_cap_change_not_net_flow",
    }),
    metric("btc.marketCap", "Bitcoin market cap", "BTC 总市值", btcMarketCap, "USD", btcQuote.last_updated || btcRow?.last_updated, source, {
      changePct24h: finiteNumber(btcQuote.percent_change_24h),
      semantics: "market_cap_change_not_net_flow",
    }),
    metric("stablecoin.usdt.marketCap", "USDT circulating market cap", "USDT 流通市值", usdtMarketCap, "USD", usdtQuote.last_updated || usdtRow?.last_updated, source, {
      changePct24h: finiteNumber(usdtQuote.percent_change_24h),
      semantics: "circulating_supply_proxy",
    }),
    metric("stablecoin.usdc.marketCap", "USDC circulating market cap", "USDC 流通市值", usdcMarketCap, "USD", usdcQuote.last_updated || usdcRow?.last_updated, source, {
      changePct24h: finiteNumber(usdcQuote.percent_change_24h),
      semantics: "circulating_supply_proxy",
    }),
    metric("stablecoin.major.marketCap", "USDT + USDC market cap", "主流稳定币市值", trackedStablecoinMarketCap, "USD", [usdtQuote.last_updated, usdcQuote.last_updated].filter(Boolean).sort()[0] || null, source, {
      coverage: ["USDT", "USDC"],
      semantics: "tracked_stablecoin_supply_not_total_market",
    }),
    metric("stablecoin.usdt.depegBps", "USDT peg deviation", "USDT 脱锚幅度", finiteNumber(usdtQuote.price) == null ? null : (finiteNumber(usdtQuote.price) - 1) * 10_000, "bps", usdtQuote.last_updated || usdtRow?.last_updated, source, {
      price: finiteNumber(usdtQuote.price),
      semantics: "price_deviation_not_flow",
    }),
  ];
}

export function normalizeSosoEtfHistory(payload, asset) {
  const rows = Array.isArray(payload?.data?.list) ? payload.data.list : [];
  const daily = rows
    .map((row) => ({
      date: String(row?.date || ""),
      netFlowUsd: finiteNumber(row?.totalNetInflow),
      totalValueTradedUsd: finiteNumber(row?.totalValueTraded),
      totalNetAssetsUsd: finiteNumber(row?.totalNetAssets),
      cumulativeNetFlowUsd: finiteNumber(row?.cumNetInflow),
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.netFlowUsd != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-300);
  return {
    asset,
    cadence: "daily",
    status: daily.length ? "available" : "unavailable",
    source: "sosovalue",
    observedAt: daily.at(-1)?.date || null,
    daily,
    weekly: aggregateWeeklyFlows(daily),
  };
}

export function normalizeBlockbeatsBtcHistory(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const daily = rows
    .map((row) => ({
      date: String(row?.date || ""),
      netFlowUsd: finiteNumber(row?.net_inflow_million) == null ? null : finiteNumber(row.net_inflow_million) * 1_000_000,
      cumulativeNetFlowUsd: finiteNumber(row?.total_inflow_million) == null ? null : finiteNumber(row.total_inflow_million) * 1_000_000,
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.netFlowUsd != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    source: "blockbeats",
    role: "auxiliary_cross_check_only",
    observedAt: daily.at(-1)?.date || null,
    daily,
  };
}

function mondayDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
}

export function aggregateWeeklyFlows(daily) {
  const groups = new Map();
  for (const point of daily) {
    const week = mondayDate(point.date);
    const current = groups.get(week) || { week, netFlowUsd: 0, tradingDays: 0 };
    current.netFlowUsd += point.netFlowUsd;
    current.tradingDays += 1;
    groups.set(week, current);
  }
  return [...groups.values()].sort((a, b) => a.week.localeCompare(b.week));
}

function pointDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function mergeMetricHistory(existingHistory, metrics) {
  const next = { ...(existingHistory || {}) };
  for (const item of metrics) {
    const date = pointDate(item.observedAt);
    if (!date || item.value == null) continue;
    const points = Array.isArray(next[item.id]) ? [...next[item.id]] : [];
    const filtered = points.filter((point) => point.date !== date);
    filtered.push({ date, value: item.value });
    next[item.id] = filtered
      .filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && finiteNumber(point.value) != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-CRYPTO_LIQUIDITY_HISTORY_DAYS);
  }
  return next;
}

export function attachMetricChanges(metrics, history) {
  return metrics.map((item) => {
    const points = history?.[item.id] || [];
    const current = points.at(-1);
    const previous = points.at(-2);
    const target = current ? new Date(`${current.date}T00:00:00Z`).getTime() - 7 * DAY_MS : null;
    const weekAgo = target == null ? null : [...points].reverse().find((point) => new Date(`${point.date}T00:00:00Z`).getTime() <= target);
    return {
      ...item,
      change1d: current && previous ? current.value - previous.value : null,
      change7d: current && weekAgo ? current.value - weekAgo.value : null,
    };
  });
}
