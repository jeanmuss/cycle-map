const NON_TRADABLE_INDEX_PHASES = new Set(["fixed-price-gap", "fixed-price"]);

export function assetSessionStatus(asset, marketStatus, labels = {}) {
  if (
    asset?.sessionEligibility !== "non_tradable_index_proxy"
    || !NON_TRADABLE_INDEX_PHASES.has(marketStatus?.key)
  ) return marketStatus;

  return {
    ...marketStatus,
    key: "non-tradable-index-proxy",
    label: labels.nonTradableIndexProxy || "N/A",
    active: false,
  };
}
