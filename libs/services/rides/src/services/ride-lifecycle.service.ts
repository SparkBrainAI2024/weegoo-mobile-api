import { Injectable } from "@nestjs/common";
import { HttpStatus } from "@nestjs/common";
import { Types } from "mongoose";
import { ErrorException } from "@libs/common/exceptions";
import { toMongoId } from "@libs/common";
import {
  RidesRepository,
  User,
  RidesDocument,
  RideStatus,
  RideTypes,
  ProvinceEnum,
  roles,
} from "@libs/data-access";
import { IssueRepository } from "@libs/data-access/repositories/issue.repository";
import {
  CategoryAccessedByRole,
  IssueCategoryForRole,
  IssueParentCategory,
} from "@libs/data-access/enums/issue.enum";
import axios from "axios";
import { CancelRideInput } from "@libs/data-access/dtos/input/cancel-ride.input";
import { UpdateRideInput } from "@libs/data-access/dtos/input/update-ride.input";
import { TransactionService } from "@libs/services/payment/src/transaction/transaction.service";
import { WalletService } from "@libs/services/payment/src/wallet/wallet.service";

/**
 * Mutations that change ride state: create, start, complete, cancel,
 * update upcoming ride, and the sample-rides seed generator.
 */
@Injectable()
export class RideLifecycleService {
  constructor(
    private readonly rideRepository: RidesRepository,
    private readonly issueRepository: IssueRepository,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Creates a new ride with an auto-generated rideUUId using nanoid.
   * Also calculates timeToReachRiderInMinutes and timeToReachRider based on
   * distance and booking time before saving.
   */
  async createRide(rideData: Partial<RidesDocument>): Promise<RidesDocument> {
    return this.rideRepository.createRide(rideData);
  }

  /**
   * Starts a ride by setting rideStartedAt and updating ride status to ONGOING.
   * Calculates estimatedTimeInMinutes and estimatedFare based on distance.
   */
  async startRide(
    rideId: Types.ObjectId,
    startedAt: Date,
    distanceInKm?: number,
  ): Promise<RidesDocument | null> {
    return this.rideRepository.startRide(rideId, startedAt, distanceInKm);
  }

  /**
   * Completes a ride by setting rideCompletedAt, rideStatus to COMPLETED.
   * Calculates actual duration from rideStartedAt to rideCompletedAt.
   */
  async completeRide(
    rideId: Types.ObjectId,
    completedAt: Date,
    distanceInKm?: number,
  ): Promise<any> {
    const ride = await this.rideRepository.completeRide(
      rideId,
      completedAt,
      distanceInKm,
    );
    if (!ride) return null;
    const userId = ride.passengerId?.toString();
    const walletAmount = userId
      ? await this.walletService.getBalance(userId)
      : 0;
    const rideObj = (ride as any).toObject ? (ride as any).toObject() : ride;
    return {
      ...rideObj,
      _id: ride._id.toString(),
      rideCompletedAt: ride.rideCompletedAt,
      walletAmount,
    };
  }

  /**
   * Cancels a ride with full validation (ownership, status, cancel reason).
   */
  async cancelRide(user: User, input: CancelRideInput): Promise<RidesDocument> {
    const userLoginAs = user.loginAs === roles.RIDER ? "DRIVER" : "PASSENGER";
    const ride = await this.rideRepository.findById(
      new Types.ObjectId(input.rideId),
    );

    if (!ride) {
      ErrorException(null, "RIDES.RIDE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    const subCategory = await this.issueRepository.findIssueCategoryById(
      input.cancelSubCategoryId,
    );

    if (
      subCategory.parentCategory.toLowerCase() !==
      IssueParentCategory.CANCEL.toLowerCase()
    ) {
      ErrorException(
        null,
        "RIDES.INVALID_CANCEL_SUB_CATEGORY",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      !(
        subCategory.categoryForRole === IssueCategoryForRole.BOTH ||
        subCategory.categoryForRole === (userLoginAs as IssueCategoryForRole)
      )
    ) {
      ErrorException(
        null,
        "RIDES.INVALID_CANCEL_SUB_CATEGORY",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      subCategory.label.toLowerCase() === "other" &&
      !input.cancelReasonContent
    ) {
      ErrorException(
        null,
        "RIDES.CANCEL_REASON_REQUIRED_FOR_OTHER",
        HttpStatus.BAD_REQUEST,
      );
    }

    const isPassenger = ride.passengerId.toString() === user._id.toString();
    const isDriver = ride.driverId.toString() === user._id.toString();

    if (!isPassenger && !isDriver) {
      ErrorException(null, "RIDES.CANCEL_UNAUTHORIZED", HttpStatus.FORBIDDEN);
    }

    if (ride.rideStatus === RideStatus.CANCELLED) {
      ErrorException(
        null,
        "RIDES.CANCEL_ALREADY_CANCELLED",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (ride.rideStatus === RideStatus.COMPLETED) {
      ErrorException(
        null,
        "RIDES.CANCEL_ALREADY_COMPLETED",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (ride.rideStatus === RideStatus.ONGOING) {
      ErrorException(null, "RIDES.CANCEL_IN_PROGRESS", HttpStatus.BAD_REQUEST);
    }

    if (ride.rideStatus === RideStatus.PENDING) {
      ErrorException(null, "RIDES.CANCEL_PENDING", HttpStatus.BAD_REQUEST);
    }

    const cancelledRide = await this.rideRepository.cancelRide({
      rideId: input.rideId,
      cancelledBy: user._id,
      cancelledByRole: userLoginAs as CategoryAccessedByRole,
      cancelSubCategoryId: toMongoId(input.cancelSubCategoryId),
      cancelSubCategoryLabel: input.cancelSubCategoryLabel,
      cancelReasonContent: input.cancelReasonContent,
    });

    // Send cancel ride notification to the matchmaking service (Ably + push notification)
    // This is done asynchronously to not block the cancellation response
    this.sendCancelRideNotification(input.rideId, user).catch((err: any) => {
      console.error(
        `Failed to send cancel ride notification: ${err?.message || err}`,
      );
    });

    return cancelledRide;
  }

  /**
   * Sends a cancel ride notification to the matchmaking service via GraphQL.
   * Publishes a ride-cancelled event on the Ably channel and sends push notifications
   * to the other party (passenger or driver).
   */
  private async sendCancelRideNotification(
    rideId: string,
    user: User,
  ): Promise<void> {
    try {
      const matchmakingUrl =
        process.env.RIDE_MATCHMAKING_URL || "http://localhost:3004";
      const userRole = user.loginAs === roles.RIDER ? roles.RIDER : roles.USER;

      const query = `mutation CancelRideNotification($rideId: String!, $userId: String!, $roles: String!) {
        cancelRideNotification(rideId: $rideId, userId: $userId, roles: $roles) {
          success message
        }
      }`;

      await axios.post(`${matchmakingUrl}/graphql`, {
        query,
        variables: {
          rideId,
          userId: user._id.toString(),
          roles: userRole,
        },
      });
    } catch (err: any) {
      console.error(
        `Failed to send cancel ride notification to matchmaking service: ${err?.message || err}`,
      );
    }
  }

  /**
   * Updates an upcoming confirmed ride's booking time, pickup location, and/or dropoff location.
   */
  async updateRide(user: User, input: UpdateRideInput): Promise<any> {
    const existingRide =
      await this.rideRepository.findUpcomingConfirmedRideById(
        input.rideId,
        user,
      );

    if (!existingRide) {
      ErrorException(null, "RIDES.UPDATE_RIDE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    const updateData: {
      bookingTime?: Date;
      pickupLocation?: any;
      dropoffLocation?: any;
      noOfPassengers?: number;
    } = {};

    if (input.bookingTime) {
      const now = new Date();
      const minAllowedBookingTime = new Date(
        existingRide.bookingTime.getTime() - 24 * 60 * 60 * 1000,
      );

      if (input.bookingTime < now) {
        ErrorException(
          null,
          "RIDES.INVALID_BOOKING_TIME",
          HttpStatus.BAD_REQUEST,
        );
      }
      if (input.bookingTime < minAllowedBookingTime) {
        ErrorException(
          null,
          "RIDES.BOOKING_TIME_LIMIT_EXCEEDED",
          HttpStatus.BAD_REQUEST,
        );
      }

      const bufferMinutes = 60;
      const startTime = new Date(
        input.bookingTime.getTime() - bufferMinutes * 60000,
      );
      const endTime = new Date(
        input.bookingTime.getTime() + bufferMinutes * 60000,
      );

      const overlapFilter: any = {
        _id: { $ne: toMongoId(input.rideId) },
        rideStatus: {
          $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP],
        },
        bookingTime: { $gte: startTime, $lte: endTime },
        deleted: false,
      };

      if (user.loginAs === roles.USER) {
        overlapFilter.passengerId = user._id;
      } else {
        overlapFilter.driverId = user._id;
      }

      const overlappingRide = await this.rideRepository.findOne(overlapFilter);
      if (overlappingRide) {
        ErrorException(null, "RIDES.RIDE_OVERLAP", HttpStatus.BAD_REQUEST);
      }

      updateData.bookingTime = input.bookingTime;
    }

    if (input.noOfPassengers) {
      updateData.noOfPassengers = input.noOfPassengers;
    }

    if (input.pickupLocation) {
      updateData.pickupLocation = {
        type: "Point",
        coordinates: [
          input.pickupLocation.longitude,
          input.pickupLocation.latitude,
        ],
        address: input.pickupLocation.address,
        city: input.pickupLocation.city || "",
        province: input.pickupLocation.province || ProvinceEnum.BAGMATI,
        district: input.pickupLocation.district || "",
        fullAddress: input.pickupLocation.fullAddress,
      };
    }

    if (input.dropoffLocation) {
      updateData.dropoffLocation = {
        type: "Point",
        coordinates: [
          input.dropoffLocation.longitude,
          input.dropoffLocation.latitude,
        ],
        address: input.dropoffLocation.address,
        city: input.dropoffLocation.city || "",
        province: input.dropoffLocation.province || ProvinceEnum.BAGMATI,
        district: input.dropoffLocation.district || "",
        fullAddress: input.dropoffLocation.fullAddress,
      };
    }

    const updatedRide = await this.rideRepository.updateUpcomingConfirmedRide(
      input.rideId,
      user,
      updateData,
    );

    if (!updatedRide) {
      ErrorException(null, "RIDES.UPDATE_RIDE_FAILED", HttpStatus.BAD_REQUEST);
    }

    return {
      _id: updatedRide._id,
      ride: updatedRide,
      message: "RIDES.UPDATE_RIDE_SUCCESS",
    };
  }

  /**
   * Generates sample rides and transactions for testing purposes.
   */
  async generateSampleRides(
    driverId: Types.ObjectId,
    riderId: Types.ObjectId,
    vehicleId: Types.ObjectId,
    adminId: Types.ObjectId,
  ): Promise<RidesDocument[]> {
    const generatedRides: RidesDocument[] = [];

    // ---- Instant rides ----
    const instantStatuses: RideStatus[] = [
      RideStatus.ONGOING,
      RideStatus.COMPLETED,
      RideStatus.COMPLETED,
      RideStatus.COMPLETED,
      RideStatus.CANCELLED,
      RideStatus.CANCELLED,
      RideStatus.CANCELLED,
      RideStatus.CANCELLED,
      RideStatus.CANCELLED,
    ];

    for (const rideStatus of instantStatuses) {
      const ride = await this.buildAndSaveRide({
        rideType: RideTypes.INSTANT,
        rideStatus,
        driverId,
        riderId,
        vehicleId,
        adminId,
        index: generatedRides.length,
      });
      generatedRides.push(ride);
    }

    // ---- Scheduled rides ----
    const scheduledStatuses: RideStatus[] = [
      ...Array(10).fill(RideStatus.CONFIRMED),
      ...Array(10).fill(RideStatus.PENDING),
      ...Array(3).fill(RideStatus.COMPLETED),
      ...Array(5).fill(RideStatus.CANCELLED),
    ];

    for (const rideStatus of scheduledStatuses) {
      const ride = await this.buildAndSaveRide({
        rideType: RideTypes.SCHEDULED,
        rideStatus,
        driverId,
        riderId,
        vehicleId,
        adminId,
        index: generatedRides.length,
      });
      generatedRides.push(ride);
    }

    return generatedRides;
  }

  private async buildAndSaveRide(params: {
    rideType: RideTypes;
    rideStatus: RideStatus;
    driverId: Types.ObjectId;
    riderId: Types.ObjectId;
    vehicleId: Types.ObjectId;
    adminId: Types.ObjectId;
    index: number;
  }): Promise<RidesDocument> {
    const {
      rideType,
      rideStatus,
      driverId,
      riderId,
      vehicleId,
      adminId,
      index,
    } = params;

    let rideStartedAt: Date | undefined;
    let rideCompletedAt: Date | undefined;

    const isFutureBooking =
      rideType === RideTypes.SCHEDULED &&
      (rideStatus === RideStatus.CONFIRMED ||
        rideStatus === RideStatus.PENDING);
    let bookingTime: Date;
    if (isFutureBooking) {
      bookingTime = new Date(Date.now() + 30 * 24 * 3600000);
    } else {
      bookingTime = new Date(Date.now() - Math.random() * 3600000 * 24);
    }
    const distanceInKm = parseFloat((Math.random() * 15 + 2).toFixed(1));

    if (
      rideStatus === RideStatus.ONGOING ||
      rideStatus === RideStatus.COMPLETED
    ) {
      rideStartedAt = new Date(
        bookingTime.getTime() + Math.random() * 10 * 60000,
      );
    }
    if (rideStatus === RideStatus.COMPLETED && rideStartedAt) {
      const travelTimeMs = distanceInKm * 2 * 60000 + Math.random() * 5 * 60000;
      rideCompletedAt = new Date(rideStartedAt.getTime() + travelTimeMs);
    }

    const baseFare = 50;
    const perKmRate = 20;
    const perMinuteRate = 5;
    let estimatedFare = baseFare + distanceInKm * perKmRate;

    if (
      rideStatus === RideStatus.COMPLETED &&
      rideStartedAt &&
      rideCompletedAt
    ) {
      const durationMs = rideCompletedAt.getTime() - rideStartedAt.getTime();
      const actualMinutes = Math.ceil(durationMs / 60000);
      estimatedFare =
        baseFare + distanceInKm * perKmRate + actualMinutes * perMinuteRate;
    }

    const rideData: Partial<RidesDocument> = {
      rideType,
      bookingTime,
      rideStatus,
      passengerId: riderId,
      driverId,
      vehicleId,
      distanceInKm,
      estimatedFare,
      rideStartedAt,
      rideCompletedAt,
      pickupLocation: {
        address: `Kathmandu ward -${index + 1}`,
        city: "Kathmandu",
        province: ProvinceEnum.BAGMATI,
        district: "Kathmandu",
        fullAddress: `Kathmandu ward -${index + 1}`,
        type: "Point",
        coordinates: [85.3 + Math.random() * 0.1, 27.7 + Math.random() * 0.1],
      } as any,
      dropoffLocation: {
        address: `Kathmandu ward ${index + 2}`,
        city: "Kathmandu",
        province: ProvinceEnum.BAGMATI,
        district: "Kathmandu",
        fullAddress: `  Kathmandu ward ${index + 2}`,
        type: "Point",
        coordinates: [85.4 + Math.random() * 0.1, 27.8 + Math.random() * 0.1],
      } as any,
      deleted: false,
    };

    const newRide = await this.rideRepository.createRide(rideData);

    if (
      newRide.rideStatus === RideStatus.CONFIRMED &&
      process.env.NODE_ENV !== "local"
    ) {
      await this.transactionService.createRideTransactions({
        tripId: newRide._id.toString(),
        adminId: adminId.toString(),
        riderId: newRide.passengerId.toString(),
        driverId: newRide.driverId.toString(),
        totalFare: Number(newRide.estimatedFare),
        commission: Number(newRide.estimatedFare) * 0.2,
      });
    }

    return newRide;
  }
}