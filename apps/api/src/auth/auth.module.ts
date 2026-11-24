import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AccountMergeService } from "./account-merge.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { GOOGLE_TOKEN_VERIFIER, GoogleTokenVerifier } from "./google-token-verifier.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: "30d" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    AccountMergeService,
    { provide: GOOGLE_TOKEN_VERIFIER, useClass: GoogleTokenVerifier },
  ],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
