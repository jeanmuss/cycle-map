import { createElement } from "react";
import { CryptoCyclePage, cryptoMetadata } from "../pages/CryptoPage.jsx";
import { RouteRuntime } from "../pages/RouteRuntime.jsx";

export default function CryptoRoute() {
  return createElement(RouteRuntime, { PageComponent: CryptoCyclePage, metadata: cryptoMetadata });
}
