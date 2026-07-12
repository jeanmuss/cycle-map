import { routePathname } from "./data.js";

export const ADMIN_PAGE_ENABLED = import.meta.env.DEV;

export function currentPage() {
  if (typeof window === "undefined") return "crypto";
  const hashPath = window.location.hash.replace(/^#/, "");
  if (ADMIN_PAGE_ENABLED && hashPath.startsWith("/admin/macro-events")) return "macroAdmin";
  if (hashPath.startsWith("/crypto-liquidity")) return "cryptoLiquidity";
  if (hashPath.startsWith("/robot-chain")) return "robotChain";
  if (hashPath.startsWith("/chip-chain")) return "chipChain";
  if (hashPath.startsWith("/market-clock")) return "marketClock";
  if (hashPath.startsWith("/macro-calendar")) return "macro";
  if (hashPath.startsWith("/equity-macro")) return "equity";
  if (hashPath.startsWith("/") || hashPath === "") return "crypto";
  const pathname = routePathname(window.location.pathname);
  if (ADMIN_PAGE_ENABLED && pathname.startsWith("/admin/macro-events")) return "macroAdmin";
  if (pathname.startsWith("/crypto-liquidity")) return "cryptoLiquidity";
  if (pathname.startsWith("/robot-chain")) return "robotChain";
  if (pathname.startsWith("/chip-chain")) return "chipChain";
  if (pathname.startsWith("/market-clock")) return "marketClock";
  if (pathname.startsWith("/macro-calendar")) return "macro";
  return pathname.startsWith("/equity-macro") ? "equity" : "crypto";
}
