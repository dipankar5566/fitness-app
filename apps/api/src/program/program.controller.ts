import { Controller, Get } from "@nestjs/common";
import { ProgramService } from "./program.service.js";

@Controller("program")
export class ProgramController {
  constructor(private readonly program: ProgramService) {}

  /** Built-in program library - PRD section 5.4. No auth guard: like /exercise, this is shared
   * reference data, not account-owned (no user-created programs exist yet). */
  @Get()
  async list() {
    return this.program.listBuiltIn();
  }
}
