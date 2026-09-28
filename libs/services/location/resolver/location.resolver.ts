import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { CreateLocationInput } from "@libs/data-access/dtos/input/create-location.input";
import {
  AddSubLocationInput,
  UpdateSubLocationInput,
} from "@libs/data-access/dtos/input/sub-location.input";
import { UpdateLocationMasterInput } from "@libs/data-access/dtos/input/update-location.input";
import { LocationListWithPaginationResponse } from "@libs/data-access/dtos/response/location-list-with-pagination.response";
import { Location } from "@libs/data-access/entities/location.entity";
import { SubLocation } from "@libs/data-access/entities/location-sublocation.embedded";
import { LocationStatus } from "@libs/data-access/enums/location.enum";
import { PaginationInput } from "@libs/data-access/base/base.input";
import { LocationService } from "../location.service";

// admin resolver - admin API
@UseGuards(AdminAuthGuard)
@Resolver(() => Location)
export class LocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Query(() => LocationListWithPaginationResponse, {
    name: "locations",
    description:
      "Paginated list of locations, optionally filtered by status (ACTIVE | INACTIVE).",
  })
  async locations(
    @Args("paginationInput") paginationInput: PaginationInput,
    @Args("status", {
      type: () => LocationStatus,
      nullable: true,
      description: "Optional status filter",
    })
    status?: LocationStatus,
  ): Promise<LocationListWithPaginationResponse> {
    return this.locationService.findAll(paginationInput, status);
  }

  @Query(() => Location, {
    name: "location",
    description: "Returns one location with its sub-locations.",
  })
  async location(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Location> {
    return this.locationService.findById(id);
  }

  @Query(() => [SubLocation], {
    name: "locationSubLocations",
    description:
      "Returns the sub-locations of one location, optionally filtered by status.",
  })
  async locationSubLocations(
    @Args("locationId", { type: () => ID }) locationId: string,
    @Args("status", { type: () => LocationStatus, nullable: true })
    status?: LocationStatus,
  ): Promise<SubLocation[]> {
    return this.locationService.findSubLocations(locationId, status);
  }

  @Mutation(() => Location, {
    name: "createLocation",
    description:
      "Creates one location without any sub-location. Sub-locations are added one by one with addSubLocation.",
  })
  async createLocation(
    @Args("input") input: CreateLocationInput,
  ): Promise<Location> {
    return this.locationService.create(input);
  }

  @Mutation(() => Location, {
    name: "updateLocation",
    description: "Updates the location's own name / coordinates.",
  })
  async updateLocation(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateLocationMasterInput,
  ): Promise<Location> {
    return this.locationService.update(id, input);
  }

  @Mutation(() => Location, {
    name: "updateLocationStatus",
    description: "Activates or deactivates a whole location.",
  })
  async updateLocationStatus(
    @Args("id", { type: () => ID }) id: string,
    @Args("status", { type: () => LocationStatus }) status: LocationStatus,
  ): Promise<Location> {
    return this.locationService.updateStatus(id, status);
  }

  @Mutation(() => Location, {
    name: "addSubLocation",
    description:
      "Adds ONE sub-location (address + latitude + longitude) to an existing location.",
  })
  async addSubLocation(
    @Args("locationId", { type: () => ID }) locationId: string,
    @Args("input") input: AddSubLocationInput,
  ): Promise<Location> {
    return this.locationService.addSubLocation(locationId, input);
  }

  @Mutation(() => Location, {
    name: "addSubLocations",
    description:
      "Adds multiple sub-locations to one location in a single call.",
  })
  async addSubLocations(
    @Args("locationId", { type: () => ID }) locationId: string,
    @Args("inputs", { type: () => [AddSubLocationInput] })
    inputs: AddSubLocationInput[],
  ): Promise<Location> {
    return this.locationService.addSubLocations(locationId, inputs);
  }

  @Mutation(() => Location, {
    name: "updateSubLocation",
    description:
      "Updates one sub-location of a location (address / latitude / longitude).",
  })
  async updateSubLocation(
    @Args("locationId", { type: () => ID }) locationId: string,
    @Args("subLocationId", { type: () => ID }) subLocationId: string,
    @Args("input") input: UpdateSubLocationInput,
  ): Promise<Location> {
    return this.locationService.updateSubLocation(
      locationId,
      subLocationId,
      input,
    );
  }

  @Mutation(() => Location, {
    name: "updateSubLocationStatus",
    description: "Activates or deactivates ONE sub-location of a location.",
  })
  async updateSubLocationStatus(
    @Args("locationId", { type: () => ID }) locationId: string,
    @Args("subLocationId", { type: () => ID }) subLocationId: string,
    @Args("status", { type: () => LocationStatus }) status: LocationStatus,
  ): Promise<Location> {
    return this.locationService.updateSubLocationStatus(
      locationId,
      subLocationId,
      status,
    );
  }

  @Mutation(() => Location, {
    name: "removeSubLocation",
    description:
      "Deletes ONE sub-location from the location's sub-location array.",
  })
  async removeSubLocation(
    @Args("locationId", { type: () => ID }) locationId: string,
    @Args("subLocationId", { type: () => ID }) subLocationId: string,
  ): Promise<Location> {
    return this.locationService.removeSubLocation(locationId, subLocationId);
  }

  @Mutation(() => Boolean, {
    name: "removeLocation",
    description: "Soft deletes a whole location.",
  })
  async removeLocation(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.locationService.remove(id);
  }
}
