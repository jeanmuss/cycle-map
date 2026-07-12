import { createElement } from "react";
import { EquityMacroPage, equityMetadata } from "../pages/EquityPage.jsx";
import { RouteRuntime } from "../pages/RouteRuntime.jsx";

export default function EquityRoute() {
  return createElement(RouteRuntime, { PageComponent: EquityMacroPage, metadata: equityMetadata });
}
