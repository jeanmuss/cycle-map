import { createElement } from "react";
import { AdminMacroEventsPage, macroAdminMetadata } from "../pages/MacroAdminPage.jsx";
import { RouteRuntime } from "../pages/RouteRuntime.jsx";

export default function MacroAdminRoute() {
  return createElement(RouteRuntime, { PageComponent: AdminMacroEventsPage, metadata: macroAdminMetadata });
}
