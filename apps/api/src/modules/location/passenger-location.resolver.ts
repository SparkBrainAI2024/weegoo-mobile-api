import { UseGuards } from "@nestjs/common";
import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { Roles } from "@libs/common";
import {
  LocationDropdownResponse,
  SubLocationDropdownResponse,
} from "@libs/data-access/dtos/response/location-dropdown.response";
import { roles } from "@libs/data-access/enums/user.enum";
import { AuthGuard, RoleGuard } from "@libs/guards";
import { LocationService } from "@libs/services/location/location.service";

// passenger resolver - passenger API
// Mirrors `DriverLocationResolver` but is exposed on the passenger app so the
// rider app can build its pickup / drop-off location dropdowns from the same
// ACTIVE locations the driver app sees.
@UseGuards(AuthGuard, RoleGuard)
@Resolver()
export class PassengerLocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Roles(roles.USER)
  @Query(() => [LocationDropdownResponse], {
    name: "locations",
    description:
      "Returns the ACTIVE locations only (sorted by name) for the passenger app's location dropdown.",
  })
  locations(): Promise<LocationDropdownResponse[]> {
    return this.locationService.findActiveLocations();
  }

  @Roles(roles.USER)
  @Query(() => [SubLocationDropdownResponse], {
    name: "locationSubLocations",
    description:
      "Returns all ACTIVE sub-locations of the location selected from the dropdown. Fails with LOCATION.NOT_FOUND when the location does not exist and with LOCATION.INACTIVE when it has been deactivated.",
  })
  locationSubLocations(
    @Args("locationId", {
      type: () => ID,
      description: "The location id selected from the location dropdown",
    })
    locationId: string,
  ): Promise<SubLocationDropdownResponse[]> {
    return this.locationService.findActiveSubLocations(locationId);
  }
}