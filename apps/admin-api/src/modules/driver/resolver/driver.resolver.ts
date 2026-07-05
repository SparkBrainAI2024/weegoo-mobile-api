import { Driver } from "@libs/data-access/dtos/response/driver-w-documents.response";
import { Args, Query, Resolver } from "@nestjs/graphql";
import { DriverService } from "../driver.service";
import { CurrentLang } from "@libs/common/decorators/header.decorators";

@Resolver(() => Driver)
export class DriverResolver {
  constructor(private readonly driverService: DriverService) {}

  @Query(() => Driver)
  async getDriver(
    @CurrentLang() lang: string,
    @Args("driverId") driverId: string,
  ): Promise<Driver> {
    return this.driverService.getDriverDetails(driverId);
  }
}
