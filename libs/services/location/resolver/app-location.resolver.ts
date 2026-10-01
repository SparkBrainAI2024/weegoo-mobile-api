import { SetMetadata, UseGuards } from "@nestjs/common";
import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import {
  LocationDropdownResponse,
  SubLocationDropdownResponse,
} from "@libs/data-access/dtos/response/location-dropdown.response";
import { roles } from "@libs/data-access/enums/user.enum";
import { AuthGuard, RoleGuard } from "@libs/guards";
import { LocationService } from "../location.service";

/**
 * Location dropdown resolver shared by the rider app (`apps/api`) and the
 * driver app (`apps/driver-api`).
 *
 * Both apps expose the exact same `locations` / `locationSubLocations`
 * queries — same names, same payloads, same ordering — so a client can be
 * pointed at either schema without changing the query it sends.
 *
 * Both roles are accepted on purpose: the queries are backed by the same
 * `LocationService` and only ever expose ACTIVE locations, which are not
 * user-specific.
 */
@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata("roles", [roles.USER, roles.RIDER])
export class AppLocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Query(() => [LocationDropdownResponse], {
    name: "locations",
    description:
      "Returns the ACTIVE locations only (sorted by name) for the app's location dropdown.",
  })
  locations(): Promise<LocationDropdownResponse[]> {
    return this.locationService.findActiveLocations();
  }

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
