import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMock = {
  init: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
};

vi.mock("@sentry/react-native", () => sentryMock);

describe("analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    sentryMock.init.mockClear();
    sentryMock.setUser.mockClear();
    sentryMock.addBreadcrumb.mockClear();
  });

  it("no-ops when EXPO_PUBLIC_SENTRY_DSN is unset", async () => {
    const { initObservability, identifyGuest, trackEvent } = await import("./analytics");

    initObservability();
    identifyGuest("account-1");
    trackEvent("guest_session_created");

    expect(sentryMock.init).not.toHaveBeenCalled();
    expect(sentryMock.setUser).not.toHaveBeenCalled();
    expect(sentryMock.addBreadcrumb).not.toHaveBeenCalled();
  });

  it("initializes Sentry without PII and forwards events when a DSN is configured", async () => {
    vi.stubEnv("EXPO_PUBLIC_SENTRY_DSN", "https://example.ingest.sentry.io/1");
    const { initObservability, identifyGuest, trackEvent } = await import("./analytics");

    initObservability();
    identifyGuest("account-1");
    trackEvent("guest_session_created", { source: "guest_loading" });

    expect(sentryMock.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://example.ingest.sentry.io/1",
        sendDefaultPii: false,
      }),
    );
    expect(sentryMock.setUser).toHaveBeenCalledWith({ id: "account-1" });
    expect(sentryMock.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: "guest_session_created" }),
    );
  });
});
