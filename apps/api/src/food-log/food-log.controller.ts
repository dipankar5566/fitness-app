import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { createFoodLogRequestSchema, updateFoodLogRequestSchema } from "@fitness-app/shared";
import type { Request } from "express";
import { ZodError } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { FoodLogService } from "./food-log.service.js";

@Controller("food-log")
@UseGuards(JwtAuthGuard)
export class FoodLogController {
  constructor(private readonly foodLog: FoodLogService) {}

  @Post()
  create(@Req() req: Request, @Body() body: unknown) {
    try {
      const input = createFoodLogRequestSchema.parse(body);
      return this.foodLog.create(req.accountId!, input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }

  @Get()
  list(@Req() req: Request, @Query("date") date?: string) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException("Query parameter 'date' is required as YYYY-MM-DD");
    }
    return this.foodLog.listByDate(req.accountId!, date);
  }

  @Patch(":id")
  update(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    try {
      const patch = updateFoodLogRequestSchema.parse(body);
      return this.foodLog.update(req.accountId!, id, patch);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }

  @Delete(":id")
  remove(@Req() req: Request, @Param("id") id: string) {
    return this.foodLog.softDelete(req.accountId!, id);
  }
}
