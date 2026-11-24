import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
}));

import {
  clearSession,
  clearSignedOutFlag,
  loadGuestSession,
  markSignedOut,
  saveGuestSession,
  wasSignedOut,
} from "./auth-storage.js";

describe("auth-storage", () => {
  beforeEach(() => {
    store.clear();
  });

  it("returns null when no session is stored", async () => {
    expect(await loadGuestSession()).toBeNull();
  });

  it("round-trips a guest session, defaulting isGuest to true", async () => {
    await saveGuestSession({ accessToken: "tok", accountId: "acc-1" });
    expect(await loadGuestSession()).toEqual({
      accessToken: "tok",
      accountId: "acc-1",
      isGuest: true,
      email: undefined,
    });
  });

  it("round-trips a Google session with isGuest false and an email", async () => {
    await saveGuestSession({ accessToken: "tok", accountId: "acc-1", isGuest: false, email: "a@example.com" });
    expect(await loadGuestSession()).toEqual({
      accessToken: "tok",
      accountId: "acc-1",
      isGuest: false,
      email: "a@example.com",
    });
  });

  it("treats a pre-existing session with no isGuest flag as a guest", async () => {
    // Simulates a session saved by the old saveGuestSession, before isGuest/email existed.
    const secureStore = await import("expo-secure-store");
    await secureStore.setItemAsync("fitness.accessToken", "legacy-token");
    await secureStore.setItemAsync("fitness.accountId", "legacy-acc");

    expect(await loadGuestSession()).toEqual({
      accessToken: "legacy-token",
      accountId: "legacy-acc",
      isGuest: true,
      email: undefined,
    });
  });

  it("clearSession removes the stored session", async () => {
    await saveGuestSession({ accessToken: "tok", accountId: "acc-1" });
    await clearSession();
    expect(await loadGuestSession()).toBeNull();
  });

  it("saving a new session after a sign-out clears the signedOut flag", async () => {
    await markSignedOut();
    expect(await wasSignedOut()).toBe(true);
    await saveGuestSession({ accessToken: "tok", accountId: "acc-1" });
    expect(await wasSignedOut()).toBe(false);
  });

  it("clearSignedOutFlag clears the flag without touching any session", async () => {
    await markSignedOut();
    await clearSignedOutFlag();
    expect(await wasSignedOut()).toBe(false);
    expect(await loadGuestSession()).toBeNull();
  });
});
