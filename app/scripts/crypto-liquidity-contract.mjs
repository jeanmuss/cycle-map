const DAY_MS = 86_400_000;

export const CRYPTO_LIQUIDITY_VERSION = 3;
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

export function normalizeCmcSpotPrices(quotesPayload) {
  return Object.fromEntries([
    ["BTC", cmcRow(quotesPayload, 1)],
    ["ETH", cmcRow(quotesPayload, 1027)],
  ].map(([asset, row]) => {
    const quote = quoteUsd(row);
    return [asset, {
      asset,
      priceUsd: finiteNumber(quote.price),
      observedAt: quote.last_updated || row?.last_updated || quotesPayload?.status?.timestamp || null,
      source: "cmc",
    }];
  }));
}

export function requireCmcLiquiditySnapshot(metrics, spotPrices) {
  const byId = Object.fromEntries((metrics || []).map((item) => [item.id, item]));
  const missing = [
    "crypto.totalMarketCap",
    "btc.marketCap",
    "stablecoin.usdt.marketCap",
    "stablecoin.usdc.marketCap",
    "stablecoin.major.marketCap",
    "stablecoin.usdt.depegBps",
  ].filter((id) => finiteNumber(byId[id]?.value) == null || !byId[id]?.observedAt);
  for (const asset of ["BTC", "ETH"]) {
    if (finiteNumber(spotPrices?.[asset]?.priceUsd) == null || !spotPrices?.[asset]?.observedAt) missing.push(`${asset} spot`);
  }
  if (missing.length) throw new Error(`CMC response omitted required fields: ${missing.join(", ")}`);
  return { metrics, spotPrices };
}

export function normalizeSosoEtfHistory(payload, asset) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.data?.list)
        ? payload.data.list
        : [];
  const daily = rows
    .map((row) => ({
      date: String(row?.date || ""),
      netFlowUsd: finiteNumber(row?.total_net_inflow ?? row?.totalNetInflow),
      totalValueTradedUsd: finiteNumber(row?.total_value_traded ?? row?.totalValueTraded),
      totalNetAssetsUsd: finiteNumber(row?.total_net_assets ?? row?.totalNetAssets),
      cumulativeNetFlowUsd: finiteNumber(row?.cum_net_inflow ?? row?.cumNetInflow),
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

export function mergeSosoEtfHistory(existingAsset, freshAsset) {
  const byDate = new Map();
  for (const point of [...(existingAsset?.daily || []), ...(freshAsset?.daily || [])]) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(point?.date || "") && finiteNumber(point?.netFlowUsd) != null) {
      byDate.set(point.date, point);
    }
  }
  const daily = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-CRYPTO_LIQUIDITY_HISTORY_DAYS);
  return {
    ...existingAsset,
    ...freshAsset,
    status: daily.length ? "available" : freshAsset?.status || existingAsset?.status || "unavailable",
    observedAt: daily.at(-1)?.date || freshAsset?.observedAt || existingAsset?.observedAt || null,
    daily,
    weekly: aggregateWeeklyFlows(daily),
  };
}

function treasuryRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.list)) return payload.data.list;
  return [];
}

export function normalizeStrategyTreasuryHistory(payload) {
  const history = treasuryRows(payload)
    .map((row) => ({
      date: String(row?.date || ""),
      disclosedAt: String(row?.date || ""),
      holdingsObservedAt: String(row?.date || ""),
      holdings: finiteNumber(row?.btc_holding),
      acquired: finiteNumber(row?.btc_acq),
      acquisitionCostUsd: finiteNumber(row?.acq_cost),
      transactionPriceUsd: finiteNumber(row?.avg_btc_cost),
      sourceUrl: "https://sosovalue-1.gitbook.io/sosovalue-api-doc/5.-btc-treasuries/purchase-history",
      qualityStatus: "provider_reported",
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.holdings != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-100);
  const latest = history.at(-1);
  return {
    company: "Strategy",
    ticker: "MSTR",
    asset: "BTC",
    status: latest ? "available" : "unavailable",
    source: "sosovalue",
    sourceUrl: latest?.sourceUrl || null,
    holdings: latest?.holdings ?? null,
    holdingsObservedAt: latest?.holdingsObservedAt || null,
    averageCostUsd: null,
    costObservedAt: null,
    averageCostMethod: null,
    latestAcquisition: latest?.acquired ?? null,
    latestAcquisitionCostUsd: latest?.acquisitionCostUsd ?? null,
    qualityStatus: latest?.qualityStatus || "unavailable",
    history,
  };
}

export function mergeTreasurySnapshots(primary, reviewed) {
  const historyBySource = new Map();
  for (const point of [...(reviewed?.history || []), ...(primary?.history || [])]) {
    const key = `${point?.sourceUrl || primary?.source || reviewed?.source || "source"}::${point?.holdingsObservedAt || point?.date || "date"}::${point?.holdings}`;
    historyBySource.set(key, point);
  }
  const history = [...historyBySource.values()].sort((a, b) => {
    const left = a.disclosedAt || a.date || a.holdingsObservedAt || "";
    const right = b.disclosedAt || b.date || b.holdingsObservedAt || "";
    return left.localeCompare(right);
  });
  const latest = history.at(-1);
  const primaryLatest = primary?.history?.at(-1);
  const costHistoryBySource = new Map();
  for (const point of [...(reviewed?.costHistory || []), ...(primary?.costHistory || [])]) {
    const key = [
      point?.sourceUrl || primary?.source || reviewed?.source || "source",
      point?.costObservedAt || "date",
      point?.holdingsAtCostDate ?? "holdings",
      point?.averageCostUsd ?? "cost",
    ].join("::");
    costHistoryBySource.set(key, point);
  }
  const costHistory = [...costHistoryBySource.values()]
    .sort((a, b) => String(a.costObservedAt || "").localeCompare(String(b.costObservedAt || "")));
  const latestCost = costHistory.at(-1);
  return {
    ...reviewed,
    ...primary,
    status: latest ? "available" : primary?.status || reviewed?.status || "unavailable",
    source: primary?.source || reviewed?.source || null,
    sourceUrl: latest?.sourceUrl || primary?.sourceUrl || reviewed?.sourceUrl || null,
    holdings: latest?.holdings ?? primary?.holdings ?? reviewed?.holdings ?? null,
    holdingsObservedAt: latest?.holdingsObservedAt || latest?.date || primary?.holdingsObservedAt || reviewed?.holdingsObservedAt || null,
    holdingsDisclosedAt: latest?.disclosedAt || primary?.holdingsDisclosedAt || reviewed?.holdingsDisclosedAt || null,
    averageCostUsd: latestCost?.averageCostUsd ?? reviewed?.averageCostUsd ?? primary?.averageCostUsd ?? null,
    costObservedAt: latestCost?.costObservedAt || reviewed?.costObservedAt || primary?.costObservedAt || null,
    averageCostMethod: latestCost?.averageCostMethod || reviewed?.averageCostMethod || primary?.averageCostMethod || null,
    latestAcquisition: primaryLatest?.acquired ?? primary?.latestAcquisition ?? reviewed?.latestAcquisition ?? null,
    latestAcquisitionCostUsd: primaryLatest?.acquisitionCostUsd ?? primary?.latestAcquisitionCostUsd ?? null,
    qualityStatus: latestCost && latestCost.costObservedAt !== (latest?.holdingsObservedAt || latest?.date)
      ? "mixed_disclosure_dates"
      : primary?.qualityStatus || reviewed?.qualityStatus || "unavailable",
    history,
    costHistory,
  };
}

export function normalizeReviewedTreasuryDisclosure(payload) {
  const holdingsHistory = (Array.isArray(payload?.holdings) ? payload.holdings : [])
    .map((row) => ({
      disclosedAt: String(row?.disclosedAt || row?.holdingsObservedAt || ""),
      holdingsObservedAt: String(row?.holdingsObservedAt || ""),
      holdings: finiteNumber(row?.holdings),
      acquired: finiteNumber(row?.acquired),
      sourceUrl: String(row?.sourceUrl || ""),
      qualityStatus: String(row?.qualityStatus || "official_filing"),
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}/.test(row.disclosedAt) && row.holdings != null)
    .sort((a, b) => a.disclosedAt.localeCompare(b.disclosedAt));
  const costHistory = (Array.isArray(payload?.costs) ? payload.costs : [])
    .map((row) => ({
      costObservedAt: String(row?.costObservedAt || ""),
      holdingsAtCostDate: finiteNumber(row?.holdingsAtCostDate),
      costBasisUsd: finiteNumber(row?.costBasisUsd),
      costBasisApproximate: row?.costBasisApproximate === true,
      averageCostUsd: finiteNumber(row?.averageCostUsd)
        ?? (finiteNumber(row?.costBasisUsd) != null && finiteNumber(row?.holdingsAtCostDate) > 0
          ? finiteNumber(row.costBasisUsd) / finiteNumber(row.holdingsAtCostDate)
          : null),
      averageCostMethod: String(row?.averageCostMethod || "reported_cost_basis_divided_by_holdings"),
      sourceUrl: String(row?.sourceUrl || ""),
      qualityStatus: String(row?.qualityStatus || "official_quarterly_filing"),
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}/.test(row.costObservedAt) && row.averageCostUsd != null)
    .sort((a, b) => a.costObservedAt.localeCompare(b.costObservedAt));
  const latest = holdingsHistory.at(-1);
  const latestCost = costHistory.at(-1);
  const previous = holdingsHistory.at(-2);
  return {
    company: String(payload?.company || ""),
    ticker: String(payload?.ticker || ""),
    asset: String(payload?.asset || ""),
    status: latest ? "available" : "unavailable",
    source: String(payload?.source || "official_company_filings"),
    sourceUrl: latest?.sourceUrl || latestCost?.sourceUrl || null,
    holdings: latest?.holdings ?? null,
    holdingsObservedAt: latest?.holdingsObservedAt || null,
    holdingsDisclosedAt: latest?.disclosedAt || null,
    averageCostUsd: latestCost?.averageCostUsd ?? null,
    costObservedAt: latestCost?.costObservedAt || null,
    averageCostMethod: latestCost?.averageCostMethod || null,
    latestAcquisition: latest?.acquired
      ?? (latest?.holdings != null && previous?.holdings != null ? latest.holdings - previous.holdings : null),
    qualityStatus: latestCost && latestCost.costObservedAt !== latest?.holdingsObservedAt
      ? "mixed_disclosure_dates"
      : latest?.qualityStatus || "unavailable",
    history: holdingsHistory,
    costHistory,
  };
}

export function attachTreasurySpotPrice(treasury, spotPrice) {
  const price = finiteNumber(spotPrice?.priceUsd);
  const cost = finiteNumber(treasury?.averageCostUsd);
  return {
    ...treasury,
    spotPriceUsd: price,
    spotObservedAt: spotPrice?.observedAt || null,
    costGapPct: price != null && cost != null && cost !== 0 ? ((price - cost) / cost) * 100 : null,
  };
}

export function requireSosoEtfHistory(result, asset = result?.asset) {
  if (!result?.daily?.length) {
    throw new Error(`SoSoValue ${asset || "ETF"} returned an empty history`);
  }
  return result;
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
    if (finiteNumber(point.cumulativeNetFlowUsd) != null) {
      current.cumulativeNetFlowUsd = finiteNumber(point.cumulativeNetFlowUsd);
    }
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
