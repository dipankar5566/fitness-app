import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { exerciseEquipmentSchema, exerciseMuscleSchema } from "@fitness-app/shared";
import { ZodError } from "zod";
import { ExerciseService } from "./exercise.service.js";

@Controller("exercise")
export class ExerciseController {
  constructor(private readonly exercise: ExerciseService) {}

  /**
   * Exercise library browse/filter - PRD section 5.4 ("filter by muscle/equipment"). No auth guard:
   * like /food/search, built-in exercises are shared reference data, not account-owned.
   */
  @Get()
  async list(@Query("muscle") muscle?: string, @Query("equipment") equipment?: string) {
    try {
      const parsedMuscle = muscle ? exerciseMuscleSchema.parse(muscle) : undefined;
      const parsedEquipment = equipment ? exerciseEquipmentSchema.parse(equipment) : undefined;
      return this.exercise.list({ muscle: parsedMuscle, equipment: parsedEquipment });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }
}
