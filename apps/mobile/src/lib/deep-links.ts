/**
 * App deep links (`fitness://...`, the `scheme` in app.json) - currently only opened by the
 * home-screen widget (src/widget/). Parsed by hand rather than via React Navigation's `linking`
 * config because every screen here needs an `accountId` route param the URL can't carry: the
 * navigator resolves the guest session first, then navigates (RootNavigator.tsx).
 */
export const DEEP_LINK_SCHEME = "fitness";

export type DeepLinkTarget = "food_search" | "today";

export const DEEP_LINKS: Record<DeepLinkTarget, string> = {
  food_search: `${DEEP_LINK_SCHEME}://log/search`,
  today: `${DEEP_LINK_SCHEME}://today`,
};

/** Maps an incoming URL to a screen, or null for anything we don't recognise (ignored, not an error). */
export function parseDeepLink(url: string | null | undefined): DeepLinkTarget | null {
  if (!url) return null;
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^?#]*)/i.exec(url.trim());
  if (!match || match[1].toLowerCase() !== DEEP_LINK_SCHEME) return null;
  const path = match[2].replace(/\/+$/, "").toLowerCase();
  if (path === "log/search") return "food_search";
  if (path === "today" || path === "") return "today";
  return null;
}
