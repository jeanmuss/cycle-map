import { createElement } from "react";
import { ChipChainPage, chipChainMetadata } from "../pages/ChipChainPage.jsx";
import { RouteRuntime } from "../pages/RouteRuntime.jsx";

export default function ChipChainRoute() {
  return createElement(RouteRuntime, { PageComponent: ChipChainPage, metadata: chipChainMetadata });
}
