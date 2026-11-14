import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { AuthService } from "./auth.service.js";

describe("AuthService", () => {
  it("inserts a guest account and signs a JWT for it", async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ id: "account-1", is_guest: true }] }) };
    const jwt = { signAsync: vi.fn().mockResolvedValue("signed-token") };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    const auth = moduleRef.get(AuthService);
    const result = await auth.createGuestAccount();

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO app.account"));
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: "account-1", guest: true });
    expect(result).toEqual({ accessToken: "signed-token", accountId: "account-1" });
  });
});
