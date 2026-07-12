function qualityText(asset) {
  return [asset?.sourceKind, asset?.dataQuality, asset?.sourceLabel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isChipSampleAsset(asset) {
  const sourceKind = String(asset?.sourceKind || "").toLowerCase();
  if (sourceKind === "sample" || sourceKind === "pending") return true;
  return /(^|[\s_/-])(sample|pending)([\s_/-]|$)/.test(qualityText(asset));
}

export function chipCategoryRows(dataset, range) {
  const assetMap = dataset?.assets || {};
  return (dataset?.categories || []).map((category) => {
    const assets = (category.tickers || [])
      .map((symbol) => assetMap[symbol])
      .filter((asset) => asset && !isChipSampleAsset(asset));
    const values = assets
      .map((asset) => Number(asset.returns?.[range]))
      .filter(Number.isFinite);
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const leader = [...assets]
      .filter((asset) => Number.isFinite(Number(asset.returns?.[range])))
      .sort((a, b) => Number(b.returns?.[range]) - Number(a.returns?.[range]))[0] || null;
    return { category, assets, average, leader };
  }).filter((row) => row.assets.length);
}

export function chipTopMovers(rows, range) {
  const seen = new Set();
  const assets = [];
  rows.forEach((row) => {
    row.assets.forEach((asset) => {
      if (!seen.has(asset.symbol) && !isChipSampleAsset(asset)) {
        seen.add(asset.symbol);
        assets.push(asset);
      }
    });
  });
  return assets
    .filter((asset) => Number.isFinite(Number(asset.returns?.[range])))
    .sort((a, b) => Number(b.returns?.[range]) - Number(a.returns?.[range]));
}

export function chipPendingAssets(dataset) {
  return Object.values(dataset?.assets || {})
    .filter(isChipSampleAsset)
    .sort((a, b) => String(a.market || "").localeCompare(String(b.market || "")) || String(a.symbol || "").localeCompare(String(b.symbol || "")));
}
