import { lazy, Suspense, useEffect, useState } from "react";
import { ADMIN_PAGE_ENABLED, currentPage } from "./routeState.js";

// Each route owns a physical page module and a separate lazy chunk.
const CryptoRoute = lazy(() => import("./routes/CryptoRoute.js"));
const CryptoLiquidityRoute = lazy(() => import("./routes/CryptoLiquidityRoute.js"));
const MacroRoute = lazy(() => import("./routes/MacroRoute.js"));
const EquityRoute = lazy(() => import("./routes/EquityRoute.js"));
const MarketClockRoute = lazy(() => import("./routes/MarketClockRoute.js"));
const ChipChainRoute = lazy(() => import("./routes/ChipChainRoute.js"));
const RobotChainRoute = lazy(() => import("./routes/RobotChainRoute.js"));
const MacroAdminRoute = ADMIN_PAGE_ENABLED
  ? lazy(() => import("./routes/MacroAdminRoute.js"))
  : null;

function routeComponent(page) {
  if (page === "macroAdmin" && MacroAdminRoute) return MacroAdminRoute;
  if (page === "cryptoLiquidity") return CryptoLiquidityRoute;
  if (page === "robotChain") return RobotChainRoute;
  if (page === "chipChain") return ChipChainRoute;
  if (page === "marketClock") return MarketClockRoute;
  if (page === "macro") return MacroRoute;
  if (page === "equity") return EquityRoute;
  return CryptoRoute;
}

export function App() {
  const [page, setPage] = useState(currentPage);

  useEffect(() => {
    const syncPage = () => setPage(currentPage());
    window.addEventListener("hashchange", syncPage);
    window.addEventListener("popstate", syncPage);
    return () => {
      window.removeEventListener("hashchange", syncPage);
      window.removeEventListener("popstate", syncPage);
    };
  }, []);

  const Page = routeComponent(page);
  return (
    <Suspense fallback={<main className="status-page" data-testid="route-loading"><p>\u6b63\u5728\u52a0\u8f7d\u9875\u9762\u2026 / Loading page\u2026</p></main>}>
      <Page />
    </Suspense>
  );
}
