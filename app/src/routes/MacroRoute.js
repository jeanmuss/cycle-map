import { createElement } from "react";
import { MacroCalendarPage, macroMetadata } from "../pages/MacroPage.jsx";
import { RouteRuntime } from "../pages/RouteRuntime.jsx";

export default function MacroRoute() {
  return createElement(RouteRuntime, { PageComponent: MacroCalendarPage, metadata: macroMetadata });
}
