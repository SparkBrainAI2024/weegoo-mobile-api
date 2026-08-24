import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import { ErrorException, toMongoId } from "@libs/common";
import {
  Availability,
  AvailabilityDocument,
} from "../entities/availability.entity";

@Injectable()
export class AvailabilityRepository extends BaseRepository<AvailabilityDocument> {
  constructor(
    @InjectModel(Availability.name)
    private readonly _model: BaseModel<AvailabilityDocument>,
  ) {
    super(_model);
  }

  /**
   * Finds the weekly availability document for a driver in the week that starts
   * on the given startDate (the Monday of that week).
   */
  async findByDriverAndWeek(
    driverId: string | Types.ObjectId,
    startDate: Date,
  ): Promise<AvailabilityDocument | null> {
    try {
      const driverObjId =
        driverId instanceof Types.ObjectId ? driverId : toMongoId(driverId);
      return await this.findOne({
        driverId: driverObjId,
        startDate,
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

  /**
   * Creates a new weekly availability document for a driver.
   */
  async createAvailability(
    data: Partial<AvailabilityDocument>,
  ): Promise<AvailabilityDocument> {
    try {
      return await this._model.create(data);
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}