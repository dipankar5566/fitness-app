import { Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("guest")
  createGuest() {
    return this.auth.createGuestAccount();
  }
}
