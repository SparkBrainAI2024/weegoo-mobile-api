import { Module } from "@nestjs/common";
import { DriverResolver } from "./resolver/driver.resolver";

@Module({
  imports: [],
  providers: [DriverResolver],
  exports: [DriverResolver],
})
export class DriverModule {}
