import { UseGuards } from "@nestjs/common";
import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { Roles } from "@libs/common";
import {
  LocationDropdownResponse,
  SubLocationDropdownResponse,
} from "@libs/data-access/dtos/response/location-dropdown.response";
import { roles } from "@libs/data-access/enums/user.enum";
import { AuthGuard, RoleGuard } from "@libs/guards";
import { LocationService } from "../location.service";

// driver resolver - driver API
@UseGuards(AuthGuard, RoleGuard)
@Resolver()
export class DriverLocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Roles(roles.RIDER)
  @Query(() => [LocationDropdownResponse], {
    name: "driverLocations",
    description:
      "Returns the ACTIVE locations only (sorted by name) for the driver app's location dropdown.",
  })
  driverLocations(): Promise<LocationDropdownResponse[]> {
    return this.locationService.findActiveLocations();
  }

  @Roles(roles.RIDER)
  @Query(() => [SubLocationDropdownResponse], {
    name: "driverLocationSubLocations",
    description:
      "Returns all ACTIVE sub-locations of the location selected from the dropdown. Fails with LOCATION.NOT_FOUND when the location does not exist and with LOCATION.INACTIVE when it has been deactivated.",
  })
  driverLocationSubLocations(
    @Args("locationId", {
      type: () => ID,
      description: "The location id selected from the location dropdown",
    })
    locationId: string,
  ): Promise<SubLocationDropdownResponse[]> {
    return this.locationService.findActiveSubLocations(locationId);
  }
}
