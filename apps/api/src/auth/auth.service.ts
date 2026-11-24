import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DatabaseService } from "../database/database.service.js";
import { AccountMergeService } from "./account-merge.service.js";
import { GOOGLE_TOKEN_VERIFIER, type GoogleTokenVerifierPort } from "./google-token-verifier.js";

export interface AccountRow {
  id: string;
  is_guest: boolean;
}

export interface GoogleSignInResult {
  accessToken: string;
  accountId: string;
  isGuest: false;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly merge: AccountMergeService,
    @Inject(GOOGLE_TOKEN_VERIFIER) private readonly googleVerifier: GoogleTokenVerifierPort,
  ) {}

  /**
   * Guest-first auth (PRD section 2 / ARCHITECTURE.md section 8): no phone/email required to start
   * using the app. The returned JWT is the only thing the device needs to keep; upgrading to a real
   * account later reassigns this same account_id rather than copying data.
   */
  async createGuestAccount(): Promise<{ accessToken: string; accountId: string }> {
    const result = await this.db.query<AccountRow>(
      "INSERT INTO app.account (is_guest, auth_provider) VALUES (true, 'guest') RETURNING id, is_guest",
    );
    const account = result.rows[0];
    const accessToken = await this.jwt.signAsync({ sub: account.id, guest: true });
    return { accessToken, accountId: account.id };
  }

  /**
   * Google Sign-In, with an optional guest upgrade/merge (ARCHITECTURE.md section 8). `guestToken`
   * is the device's current guest JWT, if any - it's verified here rather than via JwtAuthGuard
   * since this endpoint must also work for a device with no session at all (no guest token sent).
   * An invalid/expired guest token is treated the same as no token: the Google sign-in itself must
   * never fail just because the device's old guest session happened to be stale.
   */
  async signInWithGoogle(idToken: string, guestToken?: string): Promise<GoogleSignInResult> {
    const identity = await this.googleVerifier.verify(idToken);
    const guestAccountId = await this.resolveGuestAccountId(guestToken);

    const existing = await this.db.query<AccountRow>("SELECT id, is_guest FROM app.account WHERE google_sub = $1", [
      identity.sub,
    ]);

    let accountId: string;
    if (existing.rows[0]) {
      accountId = existing.rows[0].id;
      if (guestAccountId && guestAccountId !== accountId) {
        await this.db.transaction((client) => this.merge.mergeGuestInto(client, guestAccountId, accountId));
      }
    } else if (guestAccountId) {
      await this.db.query(
        "UPDATE app.account SET google_sub = $1, email = $2, auth_provider = 'google', is_guest = false WHERE id = $3",
        [identity.sub, identity.email, guestAccountId],
      );
      accountId = guestAccountId;
    } else {
      const result = await this.db.query<AccountRow>(
        "INSERT INTO app.account (google_sub, email, auth_provider, is_guest) VALUES ($1, $2, 'google', false) RETURNING id, is_guest",
        [identity.sub, identity.email],
      );
      accountId = result.rows[0].id;
    }

    const accessToken = await this.jwt.signAsync({ sub: accountId, guest: false });
    return { accessToken, accountId, isGuest: false, email: identity.email };
  }

  private async resolveGuestAccountId(guestToken?: string): Promise<string | undefined> {
    if (!guestToken) return undefined;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; guest?: boolean }>(guestToken);
      return payload.guest ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }
}
