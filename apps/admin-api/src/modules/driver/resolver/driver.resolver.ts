import { DriverWDocuments } from "@libs/data-access/dtos/response/driver-w-documents.response";
import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import { CurrentLang } from "@libs/common/decorators/header.decorators";
import { DriverService } from "@libs/services/driver/driver.service";

import { DriverDocument } from "@libs/data-access";
import { DriverDocumentService } from "@libs/services/driver-document/driver-document.service";
import {
  DeleteDriverResponse,
  DriverListItem,
  DriverListResponse,
  SuspendDriverResponse,
} from "@libs/data-access/dtos/response/driver-list.response";
import { DriverListInput } from "@libs/data-access/dtos/input/driver-list.input";
import { DeleteDriverInput } from "@libs/data-access/dtos/input/delete-driver.input";
import { DriverCommissionSummary } from "@libs/data-access/dtos/response/driver-commission-summary.response";
import { DriverTripsPage } from "@libs/data-access/dtos/response/driver-trips.response";
import { Delete } from "@nestjs/common";

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
    console.log("here", driverId);

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

  @Mutation(() => DeleteDriverResponse)
  async deleteDriver(
    @Args("input") input: DeleteDriverInput,
    @CurrentLang() lang: string,
  ): Promise<DeleteDriverResponse> {
    return this.driverService.softDeleteDriver(input.driverId, lang);
  }

  @Mutation(() => SuspendDriverResponse)
  async blockDriver(
    @Args("id", { type: () => ID }) id: string,
    @CurrentLang() lang: string,
  ): Promise<Pick<DriverListItem, "id" | "suspended"> & { message: string }> {
    const res = await this.driverService.setSuspended(id, true, lang);
    return res;
  }

  @Mutation(() => SuspendDriverResponse)
  async unblockDriver(
    @Args("id", { type: () => ID }) id: string,
    @CurrentLang() lang: string,
  ): Promise<Pick<DriverListItem, "id" | "suspended"> & { message: string }> {
    return this.driverService.setSuspended(id, false, lang);
  }

  @Query(() => DriverTripsPage)
  async driverTrips(
    @Args("driverId", { type: () => ID }) driverId: string,
    @Args("page", { type: () => Int, nullable: true }) page?: number,
    @Args("limit", { type: () => Int, nullable: true }) limit?: number,
    @Args("search", { nullable: true }) search?: string,
    @Args("status", { nullable: true }) status?: string,
    @Args("orderBy", { nullable: true }) orderBy?: string,
    @Args("order", { nullable: true }) order?: string,
  ) {
    return this.driverService.getDriverTrips(
      driverId,
      { page, limit },
      { search, status, orderBy, order },
    );
  }

  @Query(() => DriverCommissionSummary)
  async driverCommissionSummary(
    @Args("driverId", { type: () => ID }) driverId: string,
  ) {
    return this.driverService.getDriverCommissionSummary(driverId);
  }
}
