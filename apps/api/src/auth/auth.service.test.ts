import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { AccountMergeService } from "./account-merge.service.js";
import { AuthService } from "./auth.service.js";
import { GOOGLE_TOKEN_VERIFIER } from "./google-token-verifier.js";

function buildModule(overrides: {
  db?: Partial<DatabaseService>;
  jwt?: Partial<JwtService>;
  merge?: Partial<AccountMergeService>;
  googleVerifier?: { verify: ReturnType<typeof vi.fn> };
}) {
  const db = { query: vi.fn(), transaction: vi.fn(), ...overrides.db };
  const jwt = { signAsync: vi.fn(), verifyAsync: vi.fn(), ...overrides.jwt };
  const merge = { mergeGuestInto: vi.fn(), ...overrides.merge };
  const googleVerifier = overrides.googleVerifier ?? { verify: vi.fn() };

  return Test.createTestingModule({
    providers: [
      AuthService,
      { provide: DatabaseService, useValue: db },
      { provide: JwtService, useValue: jwt },
      { provide: AccountMergeService, useValue: merge },
      { provide: GOOGLE_TOKEN_VERIFIER, useValue: googleVerifier },
    ],
  })
    .compile()
    .then((moduleRef) => ({ moduleRef, db, jwt, merge, googleVerifier }));
}

describe("AuthService", () => {
  it("inserts a guest account and signs a JWT for it", async () => {
    const { moduleRef, db, jwt } = await buildModule({
      db: { query: vi.fn().mockResolvedValue({ rows: [{ id: "account-1", is_guest: true }] }) },
      jwt: { signAsync: vi.fn().mockResolvedValue("signed-token") },
    });

    const auth = moduleRef.get(AuthService);
    const result = await auth.createGuestAccount();

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO app.account"));
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: "account-1", guest: true });
    expect(result).toEqual({ accessToken: "signed-token", accountId: "account-1" });
  });

  describe("signInWithGoogle", () => {
    it("creates a new Google account when there's no existing identity and no guest token", async () => {
      const { moduleRef, db, merge, googleVerifier } = await buildModule({
        googleVerifier: { verify: vi.fn().mockResolvedValue({ sub: "g-sub-1", email: "a@example.com" }) },
        db: {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [] }) // SELECT by google_sub -> none
            .mockResolvedValueOnce({ rows: [{ id: "account-new", is_guest: false }] }), // INSERT
        },
        jwt: { signAsync: vi.fn().mockResolvedValue("signed-token") },
      });
      const auth = moduleRef.get(AuthService);

      const result = await auth.signInWithGoogle("id-token");

      expect(googleVerifier.verify).toHaveBeenCalledWith("id-token");
      expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining("INSERT INTO app.account"), [
        "g-sub-1",
        "a@example.com",
      ]);
      expect(merge.mergeGuestInto).not.toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: "signed-token",
        accountId: "account-new",
        isGuest: false,
        email: "a@example.com",
      });
    });

    it("upgrades the guest account in place when there's no existing Google identity", async () => {
      const { moduleRef, db, jwt, merge } = await buildModule({
        googleVerifier: { verify: vi.fn().mockResolvedValue({ sub: "g-sub-1", email: "a@example.com" }) },
        db: {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [] }) // SELECT by google_sub -> none
            .mockResolvedValueOnce({ rows: [] }), // UPDATE guest account
        },
        jwt: {
          verifyAsync: vi.fn().mockResolvedValue({ sub: "guest-1", guest: true }),
          signAsync: vi.fn().mockResolvedValue("signed-token"),
        },
      });
      const auth = moduleRef.get(AuthService);

      const result = await auth.signInWithGoogle("id-token", "guest-jwt");

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("UPDATE app.account SET google_sub"),
        ["g-sub-1", "a@example.com", "guest-1"],
      );
      expect(merge.mergeGuestInto).not.toHaveBeenCalled();
      expect(result.accountId).toBe("guest-1");
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: "guest-1", guest: false });
    });

    it("merges the guest account into the existing Google account via a transaction", async () => {
      const transaction = vi.fn().mockImplementation((fn: (client: unknown) => unknown) => fn({}));
      const { moduleRef, merge, jwt } = await buildModule({
        googleVerifier: { verify: vi.fn().mockResolvedValue({ sub: "g-sub-1", email: "a@example.com" }) },
        db: {
          query: vi.fn().mockResolvedValueOnce({ rows: [{ id: "account-existing", is_guest: false }] }),
          transaction,
        },
        jwt: {
          verifyAsync: vi.fn().mockResolvedValue({ sub: "guest-1", guest: true }),
          signAsync: vi.fn().mockResolvedValue("signed-token"),
        },
      });
      const auth = moduleRef.get(AuthService);

      const result = await auth.signInWithGoogle("id-token", "guest-jwt");

      expect(transaction).toHaveBeenCalled();
      expect(merge.mergeGuestInto).toHaveBeenCalledWith({}, "guest-1", "account-existing");
      expect(result.accountId).toBe("account-existing");
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: "account-existing", guest: false });
    });

    it("ignores an invalid/expired guest token and proceeds as if none was sent", async () => {
      const { moduleRef, db, merge } = await buildModule({
        googleVerifier: { verify: vi.fn().mockResolvedValue({ sub: "g-sub-1", email: "a@example.com" }) },
        db: {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: "account-new", is_guest: false }] }),
        },
        jwt: { verifyAsync: vi.fn().mockRejectedValue(new Error("expired")), signAsync: vi.fn().mockResolvedValue("t") },
      });
      const auth = moduleRef.get(AuthService);

      const result = await auth.signInWithGoogle("id-token", "stale-guest-jwt");

      expect(merge.mergeGuestInto).not.toHaveBeenCalled();
      expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining("INSERT INTO app.account"), [
        "g-sub-1",
        "a@example.com",
      ]);
      expect(result.accountId).toBe("account-new");
    });

    it("propagates a rejection from an unverifiable Google ID token", async () => {
      const { moduleRef } = await buildModule({
        googleVerifier: { verify: vi.fn().mockRejectedValue(new Error("invalid token")) },
      });
      const auth = moduleRef.get(AuthService);

      await expect(auth.signInWithGoogle("bad-token")).rejects.toThrow("invalid token");
    });
  });
});
