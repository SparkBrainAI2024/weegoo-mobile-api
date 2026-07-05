import { Module } from "@nestjs/common";
import { DriverResolver } from "./driver.resolver";

@Module({
  imports: [],
  providers: [DriverResolver],
  exports: [DriverResolver],
})
export class DriverModule {}
