import { Driver } from "@libs/data-access/dtos/response/driver-w-documents.response";
import { Args, Query, Resolver } from "@nestjs/graphql";
import { CurrentLang } from "@libs/common/decorators/header.decorators";
import { DriverService } from "@libs/services/driver/driver.service";
import { SetMetadata, UseGuards } from "@nestjs/common";
import { AuthGuard, RoleGuard } from "@libs/guards";
import { roles } from "@libs/data-access";

@UseGuards(AuthGuard, RoleGuard)
@SetMetadata("roles", [roles.ADMIN])
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
