import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Crash reporting + lightweight event tracking (CLAUDE.md M1 scope, PRD section 7: no PII, no
 * health values in any event). Every call below is a no-op until EXPO_PUBLIC_SENTRY_DSN is set, so
 * local dev and CI never need a live Sentry project.
 */
export function initObservability(): void {
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

/** Associates crashes/events with the opaque guest account id - never a phone/email. */
export function identifyGuest(accountId: string): void {
  if (!dsn) {
    return;
  }
  Sentry.setUser({ id: accountId });
}

export function trackEvent(name: string, data?: Record<string, string | number | boolean>): void {
  if (!dsn) {
    return;
  }
  Sentry.addBreadcrumb({ category: "analytics", message: name, data, level: "info" });
}
