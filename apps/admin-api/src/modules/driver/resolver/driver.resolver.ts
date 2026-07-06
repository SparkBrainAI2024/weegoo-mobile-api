import { DriverWDocuments } from "@libs/data-access/dtos/response/driver-w-documents.response";
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import { CurrentLang } from "@libs/common/decorators/header.decorators";
import { DriverService } from "@libs/services/driver/driver.service";
import { SetMetadata, UseGuards } from "@nestjs/common";
import { AuthGuard, RoleGuard } from "@libs/guards";
import { BasicResponse, DriverDocument, roles, User } from "@libs/data-access";
import { DriverDocumentService } from "@libs/services/driver-document/driver-document.service";
import {
  DriverListResponse,
  ToggleBlockDriverResponse,
} from "@libs/data-access/dtos/response/driver-list.response";
import {
  DriverListInput,
  ToggleBlockDriverInput,
} from "@libs/data-access/dtos/input/driver-list.input";
import { DeleteDriverInput } from "@libs/data-access/dtos/input/delete-driver.input";

// @UseGuards(AuthGuard, RoleGuard)
// @SetMetadata("roles", [roles.ADMIN])
@Resolver(() => DriverWDocuments)
export class DriverResolver {
  constructor(
    private readonly driverService: DriverService,
    private readonly driverDocumentService: DriverDocumentService,
  ) {}

  @Query(() => DriverWDocuments)
  async getDriver(
    @CurrentLang() lang: string,
    @Args("driverId") driverId: string,
  ): Promise<DriverWDocuments> {
    return this.driverService.getDriverDetails(driverId);
  }

  @ResolveField(() => [DriverDocument])
  async documents(@Parent() driver: DriverWDocuments) {
    return this.driverDocumentService.getDriverDocuments(driver.id);
  }

  @Query(() => DriverListResponse)
  async getDrivers(
    @Args("input", { nullable: true, type: () => DriverListInput })
    input?: DriverListInput,
  ): Promise<DriverListResponse> {
    const result = await this.driverService.listDrivers(
      input ?? new DriverListInput(),
    );
    return result;
  }

  @Mutation(() => Boolean)
  async deleteDriver(
    @Args("input") input: DeleteDriverInput,
  ): Promise<boolean> {
    return this.driverService.softDeleteDriver(input.driverId);
  }

  // drivers.resolver.ts
  @Mutation(() => ToggleBlockDriverResponse)
  async toggleBlockDriver(
    @Args("input") input: ToggleBlockDriverInput,
  ): Promise<ToggleBlockDriverResponse> {
    console.log(input, "input");

    const result = await this.driverService.toggleBlock(
      input.id,
      input.isBlocked,
    );
    console.log(result, "result");
    return result;
  }
}
