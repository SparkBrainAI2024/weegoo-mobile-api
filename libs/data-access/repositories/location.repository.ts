import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, UpdateQuery } from "mongoose";
import { ErrorException } from "@libs/common/exceptions";
import { escapeRegex, toMongoId } from "@libs/common/helpers/mongo-helper";
import { IPaginatedResult } from "@libs/data-access/interfaces/pagination.interface";
import { PaginationInput, SortBy } from "@libs/data-access/base/base.input";
import { Location, LocationDocument } from "../entities/location.entity";
import { SubLocation } from "../entities/location-sublocation.embedded";
import { LocationStatus } from "../enums/location.enum";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";

@Injectable()
export class LocationRepository extends BaseRepository<LocationDocument> {
  constructor(
    @InjectModel(Location.name)
    private readonly _model: BaseModel<LocationDocument>,
  ) {
    super(_model);
  }

  get searchKeys(): string[] {
    return ["name", "subLocations.address"];
  }

  /**
   * Finds a location by its name (case-insensitive exact match).
   */
  async findByName(name: string): Promise<LocationDocument | null> {
    try {
      return await this.findOne({
        name: new RegExp(`^${escapeRegex(name.trim())}$`, "i"),
        deleted: false,
      });
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Paginated locations, optionally filtered by status. */
  async findAll(
    input: PaginationInput,
    status?: LocationStatus,
  ): Promise<IPaginatedResult<LocationDocument>> {
    try {
      const filter: FilterQuery<LocationDocument> = { deleted: false };
      if (status) filter.status = status;

      return await this.paginate(
        { ...input, order: input.order ?? SortBy.desc },
        undefined,
        filter,
      );
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ACTIVE (and not soft-deleted) locations only, sorted alphabetically by
   * name. This is the source of the driver app's location dropdown, so no
   * pagination is applied.
   */
  async findActiveLocations(): Promise<LocationDocument[]> {
    try {
      return await this.find(
        { status: LocationStatus.ACTIVE, deleted: false },
        undefined,
        undefined,
        { sort: { name: 1 } },
      );
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Updates the location's own fields (name / coordinates). */
  async updateLocation(
    id: string,
    data: Partial<Location>,
  ): Promise<LocationDocument | null> {
    try {
      return await this.updateById(toMongoId(id), {
        $set: data,
      } as UpdateQuery<LocationDocument>);
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Activates / deactivates the location. */
  async updateLocationStatus(
    id: string,
    status: LocationStatus,
  ): Promise<LocationDocument | null> {
    try {
      return await this.updateById(toMongoId(id), {
        $set: { status },
      } as UpdateQuery<LocationDocument>);
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Pushes one sub-location (or several sub-locations at once) into the
   * location's `subLocations` array. Mongoose assigns each one its own `_id`.
   */
  async addSubLocations(
    locationId: string,
    subLocations: Partial<SubLocation>[],
  ): Promise<LocationDocument | null> {
    try {
      return await this.updateById(toMongoId(locationId), {
        $push: { subLocations: { $each: subLocations } },
      } as UpdateQuery<LocationDocument>);
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Updates the given fields of ONE sub-location (dotted positional update). */
  async updateSubLocation(
    locationId: string,
    subLocationId: string,
    data: Partial<SubLocation>,
  ): Promise<LocationDocument | null> {
    try {
      const setFields = Object.entries(data).reduce(
        (fields, [field, value]) => ({
          ...fields,
          [`subLocations.$.${field}`]: value,
        }),
        {},
      );

      return await this.findOneAndUpdate(
        this.subLocationFilter(locationId, subLocationId),
        { $set: setFields } as UpdateQuery<LocationDocument>,
      );
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Activates / deactivates ONE sub-location. */
  async updateSubLocationStatus(
    locationId: string,
    subLocationId: string,
    status: LocationStatus,
  ): Promise<LocationDocument | null> {
    try {
      return await this.findOneAndUpdate(
        this.subLocationFilter(locationId, subLocationId),
        {
          $set: { "subLocations.$.status": status },
        } as UpdateQuery<LocationDocument>,
      );
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Deletes ONE sub-location from the location's `subLocations` array. */
  async removeSubLocation(
    locationId: string,
    subLocationId: string,
  ): Promise<LocationDocument | null> {
    try {
      return await this.findOneAndUpdate(
        this.subLocationFilter(locationId, subLocationId),
        {
          $pull: { subLocations: { _id: toMongoId(subLocationId) } },
        } as UpdateQuery<LocationDocument>,
      );
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Filter that addresses one embedded sub-location of one location. */
  private subLocationFilter(
    locationId: string,
    subLocationId: string,
  ): FilterQuery<LocationDocument> {
    return {
      _id: toMongoId(locationId),
      "subLocations._id": toMongoId(subLocationId),
    };
  }
}
