import { BadRequestException, Body, Controller, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service.js";

interface GoogleSignInBody {
  idToken?: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("guest")
  createGuest() {
    return this.auth.createGuestAccount();
  }

  /**
   * No JwtAuthGuard here: a device signing in for the first time has no bearer token at all, and a
   * device upgrading/merging from a guest sends its *guest* token, not a bearer credential for this
   * call itself - AuthService verifies it internally (see signInWithGoogle's docstring).
   */
  @Post("google")
  signInWithGoogle(@Body() body: GoogleSignInBody, @Req() req: Request) {
    if (!body?.idToken) {
      throw new BadRequestException("idToken is required");
    }
    const header = req.headers.authorization;
    const guestToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    return this.auth.signInWithGoogle(body.idToken, guestToken);
  }
}
