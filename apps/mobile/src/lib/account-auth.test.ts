import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  session: null as { accessToken: string; accountId: string; isGuest?: boolean; email?: string } | null,
  signedOut: false,
};

vi.mock("./auth-storage", () => ({
  loadGuestSession: vi.fn(() => Promise.resolve(state.session)),
  saveGuestSession: vi.fn((session: typeof state.session) => {
    state.session = session;
    state.signedOut = false;
    return Promise.resolve();
  }),
  clearSession: vi.fn(() => {
    state.session = null;
    return Promise.resolve();
  }),
  markSignedOut: vi.fn(() => {
    state.signedOut = true;
    return Promise.resolve();
  }),
}));

const signInWithGooglePrompt = vi.fn();
const signOutOfGoogle = vi.fn().mockResolvedValue(undefined);
vi.mock("./google-auth", () => ({
  signInWithGooglePrompt: (...args: unknown[]) => signInWithGooglePrompt(...args),
  signOutOfGoogle: (...args: unknown[]) => signOutOfGoogle(...args),
}));

const apiSignInWithGoogle = vi.fn();
vi.mock("./api", () => ({
  signInWithGoogle: (...args: unknown[]) => apiSignInWithGoogle(...args),
}));

const wipeAccountData = vi.fn().mockResolvedValue(undefined);
vi.mock("./local-wipe", () => ({
  wipeAccountData: (...args: unknown[]) => wipeAccountData(...args),
}));

const syncNow = vi.fn().mockResolvedValue(undefined);
vi.mock("./sync-engine", () => ({
  syncNow: (...args: unknown[]) => syncNow(...args),
}));

import { countDirtyRows, signInWithGoogleFlow, signOutFlow } from "./account-auth.js";

function fakeDb(dirtyCountsByTable: Record<string, number> = {}) {
  return {
    getFirstAsync: vi.fn((sql: string) => {
      const table = Object.keys(dirtyCountsByTable).find((t) => sql.includes(`FROM ${t} `));
      return Promise.resolve({ count: table ? dirtyCountsByTable[table] : 0 });
    }),
  } as never;
}

describe("account-auth", () => {
  beforeEach(() => {
    state.session = null;
    state.signedOut = false;
    vi.clearAllMocks();
    syncNow.mockResolvedValue(undefined);
    wipeAccountData.mockResolvedValue(undefined);
    signOutOfGoogle.mockResolvedValue(undefined);
  });

  describe("countDirtyRows", () => {
    it("sums is_dirty rows across every syncable table", async () => {
      const db = fakeDb({ food_log: 2, water_log: 1 });
      expect(await countDirtyRows(db)).toBe(3);
    });
  });

  describe("signInWithGoogleFlow", () => {
    it("upgrades in place when the account id is unchanged, keeping local data", async () => {
      state.session = { accessToken: "guest-tok", accountId: "acc-1" };
      signInWithGooglePrompt.mockResolvedValue("id-token");
      apiSignInWithGoogle.mockResolvedValue({ accessToken: "new-tok", accountId: "acc-1", email: "a@x.com" });

      const result = await signInWithGoogleFlow(fakeDb(), "http://api");

      expect(result).toEqual({ accountId: "acc-1", email: "a@x.com", merged: false });
      expect(wipeAccountData).not.toHaveBeenCalled();
      expect(state.session).toEqual({ accessToken: "new-tok", accountId: "acc-1", isGuest: false, email: "a@x.com" });
    });

    it("wipes and re-pulls when the account id changes (merge)", async () => {
      state.session = { accessToken: "guest-tok", accountId: "acc-guest" };
      signInWithGooglePrompt.mockResolvedValue("id-token");
      apiSignInWithGoogle.mockResolvedValue({ accessToken: "new-tok", accountId: "acc-existing", email: "a@x.com" });

      const result = await signInWithGoogleFlow(fakeDb(), "http://api");

      expect(result.merged).toBe(true);
      expect(wipeAccountData).toHaveBeenCalledTimes(1);
      expect(syncNow).toHaveBeenCalledWith(expect.anything(), "http://api", "new-tok");
    });

    it("works with no existing guest session at all", async () => {
      state.session = null;
      signInWithGooglePrompt.mockResolvedValue("id-token");
      apiSignInWithGoogle.mockResolvedValue({ accessToken: "new-tok", accountId: "acc-new", email: "a@x.com" });

      const result = await signInWithGoogleFlow(fakeDb(), "http://api");

      expect(result).toEqual({ accountId: "acc-new", email: "a@x.com", merged: false });
      expect(apiSignInWithGoogle).toHaveBeenCalledWith("http://api", "id-token", undefined);
    });
  });

  describe("signOutFlow", () => {
    it("returns no_session when nothing is signed in", async () => {
      state.session = null;
      expect(await signOutFlow(fakeDb(), "http://api", vi.fn())).toBe("no_session");
    });

    it("signs out directly when nothing is unsynced", async () => {
      state.session = { accessToken: "tok", accountId: "acc-1", isGuest: false };
      const confirm = vi.fn();

      const result = await signOutFlow(fakeDb(), "http://api", confirm);

      expect(result).toBe("signed_out");
      expect(confirm).not.toHaveBeenCalled();
      expect(signOutOfGoogle).toHaveBeenCalled();
      expect(state.session).toBeNull();
      expect(state.signedOut).toBe(true);
    });

    it("asks for confirmation when unsynced rows remain, and cancels if declined", async () => {
      state.session = { accessToken: "tok", accountId: "acc-1", isGuest: false };
      const confirm = vi.fn().mockResolvedValue(false);

      const result = await signOutFlow(fakeDb({ food_log: 2 }), "http://api", confirm);

      expect(result).toBe("cancelled");
      expect(confirm).toHaveBeenCalledWith(2);
      expect(signOutOfGoogle).not.toHaveBeenCalled();
      expect(state.session).not.toBeNull();
    });

    it("proceeds with sign-out when the user confirms data loss", async () => {
      state.session = { accessToken: "tok", accountId: "acc-1", isGuest: false };
      const confirm = vi.fn().mockResolvedValue(true);

      const result = await signOutFlow(fakeDb({ food_log: 1 }), "http://api", confirm);

      expect(result).toBe("signed_out");
      expect(state.session).toBeNull();
    });
  });
});
