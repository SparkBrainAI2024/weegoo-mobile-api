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
   * Creates a location, optionally together with its sub-locations.
   *
   * The name AND the latitude/longitude pair must be unused, so two locations
   * can never share the same name or stand on the same spot.
   *
   * Every sub-location passed in `input.subLocations` is created in the same
   * call; more sub-locations can still be added afterwards with
   * `addSubLocation` / `addSubLocations`. A sub-location is rejected when its
   * address or its latitude/longitude pair is already used inside this
   * location (or twice inside the same request).
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

    // No sub-location exists yet, so only the entries of this request can
    // duplicate each other.
    const subLocations = this.buildNewSubLocations(input.subLocations ?? []);

    const created = await this.locationRepository.create({
      name: input.name.trim(),
      status: input.status ?? LocationStatus.ACTIVE,
      subLocations,
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
   * ACTIVE locations only, sorted by name — the list the rider and driver apps
   * use to build their location dropdown. Sub-locations are NOT included here;
   * they are fetched with `findActiveSubLocations` once a location is selected.
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

  /**
   * Updates the location's own fields and/or creates new sub-locations for it.
   *
   * `input.subLocations` is optional: when given, each entry is appended to the
   * location exactly like `addSubLocations` does, including the duplicate
   * validation (unique address and unique latitude/longitude).
   */
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
    if (input.status != undefined) {
      data.status = input.status;
    }

    if (input.latitude !== undefined || input.longitude !== undefined) {
      // Only the pair that will actually be stored has to be free.
      const latitude = input.latitude ?? location.latitude;
      const longitude = input.longitude ?? location.longitude;

      await this.assertCoordinatesAreAvailable(
        latitude,
        longitude,
        location._id.toString(),
      );

      data.latitude = latitude;
      data.longitude = longitude;
    }

    // Validated against the sub-locations the location already carries, so a
    // request can neither duplicate an existing address nor its coordinates.
    const newSubLocations = this.buildNewSubLocations(
      input.subLocations ?? [],
      location.subLocations ?? [],
    );

    if (Object.keys(data).length === 0 && newSubLocations.length === 0) {
      throw ErrorException(
        null,
        "LOCATION.NOTHING_TO_UPDATE",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Only new sub-locations were given — the location itself keeps its values.
    if (Object.keys(data).length === 0) {
      const withSubLocations = await this.locationRepository.addSubLocations(
        id,
        newSubLocations,
      );
      return this.toLocationOrThrow(withSubLocations);
    }

    const updated = await this.locationRepository.updateLocation(id, data);

    if (newSubLocations.length === 0) {
      return this.toLocationOrThrow(updated);
    }

    const withSubLocations = await this.locationRepository.addSubLocations(
      id,
      newSubLocations,
    );
    return this.toLocationOrThrow(withSubLocations ?? updated);
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

  /**
   * Adds multiple sub-locations in a single call.
   *
   * Every entry is validated against the sub-locations the location already
   * carries (`addSubLocation` is just this method with a single entry) and
   * against the other entries of the same request.
   */
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
    const newSubLocations = this.buildNewSubLocations(
      inputs,
      location.subLocations ?? [],
    );

    const updated = await this.locationRepository.addSubLocations(
      locationId,
      newSubLocations,
    );
    return this.toLocationOrThrow(updated);
  }

  /**
   * Updates the fields of ONE sub-location.
   *
   * The address must stay unique inside the location, and so must the
   * latitude/longitude pair: when coordinates are changed, the resulting pair
   * is compared with the coordinates of every other sub-location of the
   * location (the sub-location being updated is skipped).
   */
  async updateSubLocation(
    locationId: string,
    subLocationId: string,
    input: UpdateSubLocationInput,
  ): Promise<Location> {
    const location = await this.getLocationOrThrow(locationId);
    const subLocation = this.findSubLocationOrThrow(location, subLocationId);
    const otherSubLocations = location.subLocations ?? [];

    const data: Partial<SubLocation> = {};

    if (input.address !== undefined) {
      const address = this.normalizeAddress(input.address);
      if (!address) {
        throw ErrorException(
          null,
          "LOCATION.SUB_LOCATION_ADDRESS_REQUIRED",
          HttpStatus.BAD_REQUEST,
        );
      }

      this.assertAddressIsUnique(
        this.takenSubLocationValues(
          otherSubLocations,
          (sub) => this.normalizeAddress(sub.address),
          subLocationId,
        ),
        address,
      );

      data.address = input.address.trim();
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

    // Only checked when coordinates are part of the update; the pair that will
    // actually be stored is the one being validated.
    if (data.latitude !== undefined || data.longitude !== undefined) {
      const latitude = data.latitude ?? subLocation.latitude;
      const longitude = data.longitude ?? subLocation.longitude;

      this.assertCoordinatesAreUnique(
        this.takenSubLocationValues(
          otherSubLocations,
          (sub) => this.coordinatesKey(sub.latitude, sub.longitude),
          subLocationId,
        ),
        latitude,
        longitude,
      );

      // Keep the stored pair complete, even when only one of the two was sent.
      data.latitude = latitude;
      data.longitude = longitude;
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

  /**
   * Rejects a latitude/longitude pair that already belongs to another
   * location — two locations must never stand on the same spot.
   *
   * @param ignoreLocationId location allowed to keep this pair (itself, while
   *                         being updated)
   */
  private async assertCoordinatesAreAvailable(
    latitude: number,
    longitude: number,
    ignoreLocationId?: string,
  ): Promise<void> {
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return;
    }

    const duplicate = await this.locationRepository.findByCoordinates(
      latitude,
      longitude,
    );
    if (duplicate && duplicate._id.toString() !== ignoreLocationId) {
      throw ErrorException(
        null,
        "LOCATION.DUPLICATE_COORDINATES",
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * Validates the incoming sub-locations and converts them into the documents
   * that get persisted.
   *
   * An entry is rejected when its address or its latitude/longitude pair is
   * already used by another sub-location of the same location — including the
   * entries of the same request, so a payload can never create a duplicate.
   */
  private buildNewSubLocations(
    inputs: AddSubLocationInput[],
    existing: SubLocation[] = [],
  ): SubLocation[] {
    const addresses = this.takenSubLocationValues(existing, (sub) =>
      this.normalizeAddress(sub.address),
    );
    const coordinates = this.takenSubLocationValues(existing, (sub) =>
      this.coordinatesKey(sub.latitude, sub.longitude),
    );

    const newSubLocations: SubLocation[] = [];
    for (const input of inputs ?? []) {
      const address = this.normalizeAddress(input?.address);
      if (!address) {
        throw ErrorException(
          null,
          "LOCATION.SUB_LOCATION_ADDRESS_REQUIRED",
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        typeof input?.latitude !== "number" ||
        typeof input?.longitude !== "number"
      ) {
        throw ErrorException(
          null,
          "LOCATION.SUB_LOCATION_COORDINATES_REQUIRED",
          HttpStatus.BAD_REQUEST,
        );
      }

      this.assertAddressIsUnique(addresses, address);
      this.assertCoordinatesAreUnique(
        coordinates,
        input.latitude,
        input.longitude,
      );

      // Reserve the values so a later entry of the same request cannot reuse
      // them (same address or same latitude/longitude).
      addresses.add(address);
      coordinates.add(this.coordinatesKey(input.latitude, input.longitude));

      newSubLocations.push({
        address: input.address.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        status: input.status ?? LocationStatus.ACTIVE,
      });
    }

    return newSubLocations;
  }

  /** Values already taken by a location's sub-locations. */
  private takenSubLocationValues(
    subLocations: SubLocation[],
    valueOf: (subLocation: SubLocation) => string,
    ignoreSubLocationId?: string,
  ): Set<string> {
    return new Set(
      subLocations
        .filter((sub) => sub._id?.toString() !== ignoreSubLocationId)
        .map(valueOf),
    );
  }

  /** Trimmed, lower-cased address — how duplicate addresses are compared. */
  private normalizeAddress(address?: string): string {
    return (address ?? "").trim().toLowerCase();
  }

  /** Comparable key of a coordinate pair — how duplicate coordinates match. */
  private coordinatesKey(latitude?: number, longitude?: number): string {
    return `${latitude}:${longitude}`;
  }

  private assertAddressIsUnique(addresses: Set<string>, address: string): void {
    if (addresses.has(address)) {
      throw ErrorException(
        null,
        "LOCATION.SUB_LOCATION_ALREADY_EXISTS",
        HttpStatus.CONFLICT,
      );
    }
  }

  private assertCoordinatesAreUnique(
    coordinates: Set<string>,
    latitude: number,
    longitude: number,
  ): void {
    if (coordinates.has(this.coordinatesKey(latitude, longitude))) {
      throw ErrorException(
        null,
        "LOCATION.SUB_LOCATION_DUPLICATE_COORDINATES",
        HttpStatus.CONFLICT,
      );
    }
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
