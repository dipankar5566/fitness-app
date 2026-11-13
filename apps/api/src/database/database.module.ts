import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseService } from "./database.service.js";

// Explicitly import ConfigModule (even though AppModule registers it as isGlobal) so Nest's
// dependency graph has an edge forcing ConfigService to be ready before DatabaseService is
// instantiated - without this, module init order is not guaranteed and config was undefined.
@Global()
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
