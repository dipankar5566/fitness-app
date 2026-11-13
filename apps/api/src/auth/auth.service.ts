import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DatabaseService } from "../database/database.service.js";

export interface AccountRow {
  id: string;
  is_guest: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
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
}
