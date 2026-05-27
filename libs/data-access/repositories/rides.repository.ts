import { Injectable } from "@nestjs/common";
import { BaseRepository } from "../base/base.repository";
import { InjectModel } from "@nestjs/mongoose";
import { Rides, RidesDocument } from "../entities/rides.entity";
import { BaseModel } from "../base/base.model";
import { User } from "../entities/user.entity";
import { PaginationInput } from "../base/base.input";
import { IPaginatedResult } from "../interfaces/pagination.interface";
import { roles } from "../enums/user.enum";
import { Types } from "mongoose";
import { RideStatus, UpcomingRideStatus } from "../enums/rides.enum";

interface CancelRideParams {
  rideId: string;
  cancelledBy: Types.ObjectId;
  cancelledByRole: roles;
  cancelSubCategoryId: Types.ObjectId;
  cancelSubCategoryLabel: string;
  cancelReasonContent?: string;
}


@Injectable()
export class RidesRepository extends BaseRepository<RidesDocument> {
  constructor(@InjectModel(Rides.name) private readonly _model: BaseModel<RidesDocument>) {
    super(_model);
  }

  /**
   * Creates a new ride with an auto-generated rideUUId using nanoid.
   * Calculates timeToReach based on distance and booking time before saving.
   */
  async createRide(rideData: Partial<RidesDocument>): Promise<RidesDocument> {
    // Logic handled by RidesSchema.pre('save')
    const ride = await this._model.create(rideData);
    return ride;
  }

  /**
   * Updates ride with timing data when the ride starts.
   * Sets rideStartedAt and recalculates estimatedFare and estimatedTimeInMinutes
   * based on distance and booking time.
   */
  async startRide(rideId: Types.ObjectId, startedAt: Date, distanceInKm?: number): Promise<RidesDocument | null> {
    const updateData: any = {
      rideStartedAt: startedAt,
      rideStatus: "ONGOING",
    };

    if (distanceInKm) {
      updateData.distanceInKm = distanceInKm;
    }
    return this.findOneAndUpdate(
      { _id: rideId },
      { $set: updateData },
      { new: true },
    );
  }

  /**
   * Updates ride with completion data when the ride ends.
   * Uses rideStartedAt and rideCompletedAt to calculate actual duration,
   * then derives estimatedTimeInMinutes and estimatedFare.
   */
  async completeRide(rideId: Types.ObjectId, completedAt: Date, distanceInKm?: number): Promise<RidesDocument | null> {
    const ride = await this.findById(rideId);
    if (!ride || !ride.rideStartedAt) {
      return null;
    }

    const updateData: any = {
      rideCompletedAt: completedAt,
      rideStatus: "COMPLETED",
    };

    if (distanceInKm) {
      updateData.distanceInKm = distanceInKm;
    }

    return this.findOneAndUpdate(
      { _id: rideId },
      { $set: updateData },
      { new: true },
    );
  }

  /**
   * Atomic query to fetch rides based on user role with pagination.
   * - USER role: fetches rides where user is the rider (riderId)
   * - DRIVER role: fetches rides where user is the driver (driverId)
   * - Populates vehicle data to include vehicleModel and vehicleType
   * - Returns paginated results
   */
  async findRidesByUserWithPagination(
    user: Partial<User>,
    paginationInput: PaginationInput,
  ): Promise<IPaginatedResult<RidesDocument>> {
    // Build filter based on user role
    const filter: any = {
      ...paginationInput.filter,
      deleted: false, // Exclude soft-deleted rides
    };

    if (filter.rideStatus === UpcomingRideStatus) {
      filter.bookingTime = { $gt: new Date() }; // Only upcoming rides
      filter.rideStatus = { $in: [RideStatus.CONFIRMED, RideStatus.PENDING] }; // Upcoming rides are a subset of scheduled rides
    }

    // Check user roles and apply appropriate filter
    // Note: Assuming 'roles.RIDER' is the passenger and 'roles.DRIVER' is the driver.
    // If your enum naming differs (e.g., roles.USER for passenger), adjust accordingly.
    if (user.loginAs === roles.USER || user.loginAs === roles.RIDER) {
      filter.passengerId = new Types.ObjectId(user._id);
    } else if (user.loginAs === roles.RIDER) {
      filter.driverId = new Types.ObjectId(user._id);
    }

    // Populate vehicle data to include model and type/name
    const populateOptions = {
      path: "vehicleId",
    };
    // Apply pagination with the constructed filter and vehicle population
    const result = await this.paginate(paginationInput, populateOptions as any, filter);

    // Map the populated 'vehicleId' object to the 'vehicle' field for GraphQL clarity
    result.data = result.data.map((ride: any) => {
      if (ride.vehicleId && typeof ride.vehicleId === 'object') {
        ride.vehicle = ride.vehicleId;
        ride.vechicleId = ride.vehicleId._id;
        delete ride.vehicleId;// Keep the original vehicleId for reference
      }
      return ride;
    });

    return result;
  }

  async findByIdWithVehicle(rideId: string, passengerId: string): Promise<RidesDocument | null> {
    const rideWithVechile = await this._model.findOne({ _id: new Types.ObjectId(rideId), passengerId: new Types.ObjectId(passengerId) }).populate('vehicleId').exec();
    if (rideWithVechile?.vehicleId && typeof rideWithVechile?.vehicleId === 'object') {
      rideWithVechile.vehicle = rideWithVechile.vehicleId as any;
      delete rideWithVechile.vehicleId;
    }
    return rideWithVechile;
  }

async cancelRide(params: CancelRideParams): Promise<RidesDocument> {
  return this._model.findByIdAndUpdate(
    new Types.ObjectId(params.rideId),
    {
      status: RideStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: params.cancelledBy,
      cancelledByRole: params.cancelledByRole,
      cancelSubCategoryId: params.cancelSubCategoryId,
      cancelSubCategoryLabel: params.cancelSubCategoryLabel,
      cancelReasonContent: params.cancelReasonContent ?? null,
    },
    { new: true },
  );
}
}