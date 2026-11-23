import { describe, expect, it } from "vitest";
import { DEEP_LINKS, parseDeepLink } from "./deep-links";

describe("parseDeepLink", () => {
  it("round-trips every link the app itself builds", () => {
    expect(parseDeepLink(DEEP_LINKS.food_search)).toBe("food_search");
    expect(parseDeepLink(DEEP_LINKS.today)).toBe("today");
  });

  it("tolerates a trailing slash, query string and case", () => {
    expect(parseDeepLink("FITNESS://log/search/?from=widget")).toBe("food_search");
  });

  it("ignores other schemes, unknown paths and empty input", () => {
    expect(parseDeepLink("https://log/search")).toBeNull();
    expect(parseDeepLink("fitness://admin/delete")).toBeNull();
    expect(parseDeepLink(null)).toBeNull();
    expect(parseDeepLink("")).toBeNull();
  });
});
