import { createElement } from "react";
import { RobotChainPage, robotChainMetadata } from "../pages/RobotChainPage.jsx";
import { RouteRuntime } from "../pages/RouteRuntime.jsx";

export default function RobotChainRoute() {
  return createElement(RouteRuntime, { PageComponent: RobotChainPage, metadata: robotChainMetadata });
}
