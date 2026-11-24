import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
}

export const GOOGLE_TOKEN_VERIFIER = Symbol("GOOGLE_TOKEN_VERIFIER");

export interface GoogleTokenVerifierPort {
  verify(idToken: string): Promise<VerifiedGoogleIdentity>;
}

/**
 * Thin wrapper around google-auth-library's OAuth2Client, behind a DI token (GOOGLE_TOKEN_VERIFIER)
 * the same way AI_PROVIDER wraps OpenAI - lets AuthService's tests mock Google verification instead
 * of hitting Google's real tokeninfo endpoint, and keeps AuthService itself free of the SDK import.
 */
@Injectable()
export class GoogleTokenVerifier implements GoogleTokenVerifierPort {
  private readonly client: OAuth2Client;
  private readonly audience: string;

  constructor(config: ConfigService) {
    this.audience = config.getOrThrow<string>("GOOGLE_WEB_CLIENT_ID");
    this.client = new OAuth2Client(this.audience);
  }

  async verify(idToken: string): Promise<VerifiedGoogleIdentity> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: this.audience });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new Error("Google ID token missing a verified email");
    }
    return { sub: payload.sub, email: payload.email };
  }
}
