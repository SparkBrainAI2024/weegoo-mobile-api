import { Module } from "@nestjs/common";
import { EnvService } from "@libs/common/config/env.service";
import { SparrowSmsService } from "./sparrow-sms.service";

/**
 * Module that wires the Sparrow SMS service with its EnvService dependency.
 */
@Module({
  providers: [SparrowSmsService, EnvService],
  exports: [SparrowSmsService],
})
export class SparrowSmsModule {}
