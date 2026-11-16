import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { syncPushRequestSchema } from "@fitness-app/shared";
import type { Request } from "express";
import { ZodError } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { SyncService } from "./sync.service.js";

@Controller("sync")
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post()
  push(@Req() req: Request, @Body() body: unknown) {
    try {
      const input = syncPushRequestSchema.parse(body);
      return this.sync.push(req.accountId!, input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }

  @Get()
  pull(@Req() req: Request, @Query("since") since?: string) {
    return this.sync.pull(req.accountId!, since ?? null);
  }
}
