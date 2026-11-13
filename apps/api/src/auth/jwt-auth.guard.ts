import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

declare module "express" {
  interface Request {
    accountId?: string;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Missing bearer token");

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      request.accountId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
