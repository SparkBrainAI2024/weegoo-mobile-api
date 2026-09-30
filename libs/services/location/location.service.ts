import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorException } from "@libs/common/exceptions";
import { toMongoId } from "@libs/common/helpers/mongo-helper";
import { IPaginatedResult } from "@libs/data-access/interfaces/pagination.interface";
import { PaginationInput } from "@libs/data-access/base/base.input";
import { CreateLocationInput } from "@libs/data-access/dtos/input/create-location.input";
import {
  AddSubLocationInput,
  UpdateSubLocationInput,
} from "@libs/data-access/dtos/input/sub-location.input";
import { UpdateLocationMasterInput } from "@libs/data-access/dtos/input/update-location.input";
import {
  LocationDropdownResponse,
  SubLocationDropdownResponse,
} from "@libs/data-access/dtos/response/location-dropdown.response";
import {
  Location,
  LocationDocument,
} from "@libs/data-access/entities/location.entity";
import { SubLocation } from "@libs/data-access/entities/location-sublocation.embedded";
import { LocationStatus } from "@libs/data-access/enums/location.enum";
import { LocationRepository } from "@libs/data-access/repositories/location.repository";

@Injectable()
export class LocationService {
  constructor(private readonly locationRepository: LocationRepository) {}

  /**
   * Creates a location WITHOUT any sub-location.
   * Sub-locations are added afterwards, one by one, with `addSubLocation`.
   */
  async create(input: CreateLocationInput): Promise<Location> {
    const existing = await this.locationRepository.findByName(input.name);
    if (existing) {
      throw ErrorException(
        null,
        "LOCATION.ALREADY_EXISTS",
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.locationRepository.create({
      name: input.name.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      status: input.status ?? LocationStatus.ACTIVE,
      subLocations: [],
    });

    return created.toObject() as Location;
  }

  /** Paginated list of locations, optionally filtered by status. */
  async findAll(
    paginationInput: PaginationInput,
    status?: LocationStatus,
  ): Promise<IPaginatedResult<LocationDocument>> {
    return this.locationRepository.findAll(paginationInput, status);
  }

  async findById(id: string): Promise<Location> {
    const location = await this.getLocationOrThrow(id);
    return location.toObject() as Location;
  }

  /** Sub-locations of one location, optionally filtered by status. */
  async findSubLocations(
    locationId: string,
    status?: LocationStatus,
  ): Promise<SubLocation[]> {
    const location = await this.getLocationOrThrow(locationId);
    const subLocations = location.subLocations ?? [];
    return status
      ? subLocations.filter((subLocation) => subLocation.status === status)
      : subLocations;
  }

  /**
   * ACTIVE locations only, sorted by name — the list the driver app uses to
   * build its location dropdown. Sub-locations are NOT included here; they are
   * fetched with `findActiveSubLocations` once a location is selected.
   */
  async findActiveLocations(): Promise<LocationDropdownResponse[]> {
    const locations = await this.locationRepository.findActiveLocations();
    return locations.map((location) => ({
      _id: location._id.toString(),
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    }));
  }

  /**
   * All ACTIVE sub-locations of the location selected from the dropdown.
   *
   * The parent location must exist (otherwise `LOCATION.NOT_FOUND`) and still be
   * ACTIVE (otherwise `LOCATION.INACTIVE`) — an INACTIVE location must not be
   * offered for selection. INACTIVE sub-locations are filtered out.
   */
  async findActiveSubLocations(
    locationId: string,
  ): Promise<SubLocationDropdownResponse[]> {
    const location = await this.getLocationOrThrow(locationId);
    if (location.status !== LocationStatus.ACTIVE) {
      throw ErrorException(null, "LOCATION.INACTIVE", HttpStatus.BAD_REQUEST);
    }

    const subLocations = await this.findSubLocations(
      locationId,
      LocationStatus.ACTIVE,
    );
    return subLocations.map((subLocation) => ({
      _id: subLocation._id?.toString(),
      address: subLocation.address,
      latitude: subLocation.latitude,
      longitude: subLocation.longitude,
    }));
  }

  async update(
    id: string,
    input: UpdateLocationMasterInput,
  ): Promise<Location> {
    const location = await this.getLocationOrThrow(id);

    const data: Partial<Location> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.toLowerCase() !== location.name.trim().toLowerCase()) {
        const duplicate = await this.locationRepository.findByName(name);
        if (duplicate && duplicate._id.toString() !== location._id.toString()) {
          throw ErrorException(
            null,
            "LOCATION.ALREADY_EXISTS",
            HttpStatus.CONFLICT,
          );
        }
      }
      data.name = name;
    }

    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;

    if (Object.keys(data).length === 0) {
      throw ErrorException(
        null,
        "LOCATION.NOTHING_TO_UPDATE",
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.locationRepository.updateLocation(id, data);
    return this.toLocationOrThrow(updated);
  }

  /** Activates / deactivates the whole location. */
  async updateStatus(id: string, status: LocationStatus): Promise<Location> {
    await this.getLocationOrThrow(id);
    const updated = await this.locationRepository.updateLocationStatus(
      id,
      status,
    );
    return this.toLocationOrThrow(updated);
  }

  /** Adds ONE sub-location to a location. */
  async addSubLocation(
    locationId: string,
    input: AddSubLocationInput,
  ): Promise<Location> {
    return this.addSubLocations(locationId, [input]);
  }

  /** Adds multiple sub-locations in a single call (each one still validated). */
  async addSubLocations(
    locationId: string,
    inputs: AddSubLocationInput[],
  ): Promise<Location> {
    if (!inputs?.length) {
      throw ErrorException(
        null,
        "LOCATION.SUB_LOCATION_REQUIRED",
        HttpStatus.BAD_REQUEST,
      );
    }

    const location = await this.getLocationOrThrow(locationId);
    const addresses = new Set(
      (location.subLocations ?? []).map((subLocation) =>
        subLocation.address.trim().toLowerCase(),
      ),
    );

    const newSubLocations: Partial<SubLocation>[] = [];
    for (const input of inputs) {
      const address = input.address.trim();
      // Rejects addresses already stored on the location and duplicates inside
      // the same request, so the same address is never added twice.
      if (addresses.has(address.toLowerCase())) {
        throw ErrorException(
          null,
          "LOCATION.SUB_LOCATION_ALREADY_EXISTS",
          HttpStatus.CONFLICT,
        );
      }
      addresses.add(address.toLowerCase());

      newSubLocations.push({
        address,
        latitude: input.latitude,
        longitude: input.longitude,
        status: input.status ?? LocationStatus.ACTIVE,
      });
    }

    const updated = await this.locationRepository.addSubLocations(
      locationId,
      newSubLocations,
    );
    return this.toLocationOrThrow(updated);
  }

  /** Updates the fields of ONE sub-location. */
  async updateSubLocation(
    locationId: string,
    subLocationId: string,
    input: UpdateSubLocationInput,
  ): Promise<Location> {
    const location = await this.getLocationOrThrow(locationId);
    this.findSubLocationOrThrow(location, subLocationId);

    const data: Partial<SubLocation> = {};

    if (input.address !== undefined) {
      const address = input.address.trim();
      const duplicate = (location.subLocations ?? []).some(
        (subLocation) =>
          subLocation._id?.toString() !== subLocationId &&
          subLocation.address.trim().toLowerCase() === address.toLowerCase(),
      );
      if (duplicate) {
        throw ErrorException(
          null,
          "LOCATION.SUB_LOCATION_ALREADY_EXISTS",
          HttpStatus.CONFLICT,
        );
      }
      data.address = address;
    }

    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;

    if (Object.keys(data).length === 0) {
      throw ErrorException(
        null,
        "LOCATION.NOTHING_TO_UPDATE",
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.locationRepository.updateSubLocation(
      locationId,
      subLocationId,
      data,
    );
    return this.toLocationOrThrow(updated);
  }

  /** Activates / deactivates ONE sub-location. */
  async updateSubLocationStatus(
    locationId: string,
    subLocationId: string,
    status: LocationStatus,
  ): Promise<Location> {
    const location = await this.getLocationOrThrow(locationId);
    this.findSubLocationOrThrow(location, subLocationId);

    const updated = await this.locationRepository.updateSubLocationStatus(
      locationId,
      subLocationId,
      status,
    );
    return this.toLocationOrThrow(updated);
  }

  /** Deletes ONE sub-location from the location's sub-location array. */
  async removeSubLocation(
    locationId: string,
    subLocationId: string,
  ): Promise<Location> {
    const location = await this.getLocationOrThrow(locationId);
    this.findSubLocationOrThrow(location, subLocationId);

    const updated = await this.locationRepository.removeSubLocation(
      locationId,
      subLocationId,
    );
    return this.toLocationOrThrow(updated);
  }

  /** Soft deletes a whole location. */
  async remove(id: string): Promise<boolean> {
    await this.getLocationOrThrow(id);
    await this.locationRepository.softDeleteById(toMongoId(id));
    return true;
  }

  private async getLocationOrThrow(id: string): Promise<LocationDocument> {
    const location = await this.locationRepository.findById(toMongoId(id));
    if (!location) {
      throw ErrorException(null, "LOCATION.NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return location;
  }

  private findSubLocationOrThrow(
    location: LocationDocument,
    subLocationId: string,
  ): SubLocation {
    const subLocation = (location.subLocations ?? []).find(
      (sub) => sub._id?.toString() === subLocationId,
    );
    if (!subLocation) {
      throw ErrorException(
        null,
        "LOCATION.SUB_LOCATION_NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }
    return subLocation;
  }

  private toLocationOrThrow(location: LocationDocument | null): Location {
    if (!location) {
      throw ErrorException(null, "LOCATION.NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return location.toObject() as Location;
  }
}
