import { createElement } from "react";
import { CryptoLiquidityPage, cryptoLiquidityMetadata } from "../pages/CryptoLiquidityPage.jsx";
import { RouteRuntime } from "../pages/RouteRuntime.jsx";

export default function CryptoLiquidityRoute() {
  return createElement(RouteRuntime, { PageComponent: CryptoLiquidityPage, metadata: cryptoLiquidityMetadata });
}
