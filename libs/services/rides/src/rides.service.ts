import { PaginationInput, RidesRepository, User, RidesDocument, RideStatus, RideTypes, ProvinceEnum, roles, UserDetailsRepository } from '@libs/data-access';
import { Types } from 'mongoose';
import {  HttpStatus, Injectable } from '@nestjs/common';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { ErrorException } from '@libs/common/exceptions';
import { CancelRideInput } from '@libs/data-access/dtos/input/cancel-ride.input';
import { IssueRepository } from '@libs/data-access/repositories/issue.repository';
import { CategoryAccessedByRole, IssueCategoryForRole, IssueParentCategory } from '@libs/data-access/enums/issue.enum';
import { toMongoId } from '@libs/common';
import { transformToEntityNameObjectFromId } from '@libs/common/utils/entity.utils';

@Injectable()
export class RidesService {
  constructor(
    private readonly rideRepository: RidesRepository,
    private readonly transactionService: TransactionService,
    private readonly issueRepository: IssueRepository,
    private readonly userDetailsRepository: UserDetailsRepository
  ) { }

  /**
   * Fetches rides for the current user based on their role with pagination.
   * - If user role is USER: returns rides where user is the rider
   * - If user role is DRIVER: returns rides where user is the driver
   * - Vehicle data (model, name/type) is populated in the result
   * - Returns paginated results
   */
  async findRides(
    user: User,
    options: PaginationInput,
  ) {
    return this.rideRepository.findRidesByUserWithPagination(user, options);
  }

  async homeDashboardApi(
    user: User,
  ) {
    return this.rideRepository.homeDashboardApi(user);
  }
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
  async startRide(rideId: Types.ObjectId, startedAt: Date, distanceInKm?: number): Promise<RidesDocument | null> {
    return this.rideRepository.startRide(rideId, startedAt, distanceInKm);
  }

  /**
   * Completes a ride by setting rideCompletedAt, rideStatus to COMPLETED.
   * Calculates actual duration from rideStartedAt to rideCompletedAt for
   * estimatedTimeInMinutes and estimatedFare.
   */
  async completeRide(rideId: Types.ObjectId, completedAt: Date, distanceInKm?: number): Promise<RidesDocument | null> {
    return this.rideRepository.completeRide(rideId, completedAt, distanceInKm);
  }

  /**
   * Generates sample rides for testing purposes.
   * Creates the following distribution:
   *
   * Instant rides:
   *   - 1 ongoing
   *   - 3 completed
   *   - 5 cancelled
   *
   * Scheduled rides:
   *   - 10 confirmed
   *   - 10 pending
   *   - 3 completed
   *   - 5 cancelled
   *
   * The rideUUId, estimatedFare, estimatedTimeInMinutes, timeToReachRiderInMinutes,
   * and timeToReachRider are automatically calculated by the pre-save hook.
   */
  async generateSampleRides(
    driverId: Types.ObjectId,
    riderId: Types.ObjectId,
    vehicleId: Types.ObjectId,
    adminId: Types.ObjectId,
  ): Promise<RidesDocument[]> {
    const generatedRides: RidesDocument[] = [];

    // ---- Instant rides: 1 ongoing, 3 completed, 5 cancelled ----
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

    // ---- Scheduled rides: 10 confirmed, 10 pending, 3 completed, 5 cancelled ----
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

  /**
   * Builds ride data from status and type, sets time fields accordingly, and saves.
   */
  private async buildAndSaveRide(params: {
    rideType: RideTypes;
    rideStatus: RideStatus;
    driverId: Types.ObjectId;
    riderId: Types.ObjectId;
    vehicleId: Types.ObjectId;
    adminId: Types.ObjectId;
    index: number;
  }): Promise<RidesDocument> {
    const { rideType, rideStatus, driverId, riderId, vehicleId, adminId, index } = params;

    let rideStartedAt: Date | undefined;
    let rideCompletedAt: Date | undefined;

    // Scheduled confirmed/pending rides: booking time exactly 30 days in the future
    const isFutureBooking = rideType === RideTypes.SCHEDULED && (rideStatus === RideStatus.CONFIRMED || rideStatus === RideStatus.PENDING);
    let bookingTime: Date;
    if (isFutureBooking) {
      bookingTime = new Date(Date.now() + 30 * 24 * 3600000); // Exactly 30 days from now
    } else {
      bookingTime = new Date(Date.now() - Math.random() * 3600000 * 24); // Random booking time within last 24 hours
    }
    const distanceInKm = parseFloat((Math.random() * 15 + 2).toFixed(1)); // Random distance between 2.0 and 17.0 km

    if (rideStatus === RideStatus.ONGOING || rideStatus === RideStatus.COMPLETED) {
      rideStartedAt = new Date(bookingTime.getTime() + Math.random() * 10 * 60000); // Started 0-10 mins after booking
    }
    if (rideStatus === RideStatus.COMPLETED && rideStartedAt) {
      // Assuming average speed of 30km/h, so 2 minutes per km. Add some randomness.
      const travelTimeMs = distanceInKm * 2 * 60000 + Math.random() * 5 * 60000;
      rideCompletedAt = new Date(rideStartedAt.getTime() + travelTimeMs);
    }

    // Calculate estimated fare (matching the pre-save hook logic)
    const baseFare = 50;
    const perKmRate = 20;
    const perMinuteRate = 5;
    let estimatedFare = baseFare + distanceInKm * perKmRate;

    // For completed rides, also add the time-based component
    if (rideStatus === RideStatus.COMPLETED && rideStartedAt && rideCompletedAt) {
      const durationMs = rideCompletedAt.getTime() - rideStartedAt.getTime();
      const actualMinutes = Math.ceil(durationMs / 60000);
      estimatedFare = baseFare + distanceInKm * perKmRate + actualMinutes * perMinuteRate;
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
        city: 'Kathmandu',
        province: ProvinceEnum.BAGMATI,
        district: 'Kathmandu',
        fullAddress: `Kathmandu ward -${index + 1}`,
        type: 'Point',
        coordinates: [85.3 + Math.random() * 0.1, 27.7 + Math.random() * 0.1],
      } as any,
      dropoffLocation: {
        address: `Kathmandu ward ${index + 2}`,
        city: 'Kathmandu',
        province: ProvinceEnum.BAGMATI,
        district: 'Kathmandu',
        fullAddress: `  Kathmandu ward ${index + 2}`,
        type: 'Point',
        coordinates: [85.4 + Math.random() * 0.1, 27.8 + Math.random() * 0.1],
      } as any,
      deleted: false,
    };

    const newRide = await this.rideRepository.createRide(rideData);

    // Create transactions for confirmed rides in non-local environments
    if (newRide.rideStatus === RideStatus.CONFIRMED && process.env.NODE_ENV !== 'local') {
      await this.transactionService.createRideTransactions({
        tripId: newRide._id.toString(),
        adminId: adminId.toString(),
        riderId: newRide.passengerId.toString(),
        driverId: newRide.driverId.toString(),
        totalFare: newRide.estimatedFare,
        commission: newRide.estimatedFare * 0.2, // Assuming 20% commission for testing
      });
    }

    return newRide;
  }

  async cancelRide(user: User, input: CancelRideInput): Promise<RidesDocument> {

    const userLoginAs = user.loginAs === roles.RIDER ? "DRIVER" : "PASSENGER";
    const ride = await this.rideRepository.findById(new Types.ObjectId(input.rideId));

    if (!ride) {
      ErrorException(null, 'RIDES.RIDE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const subCategory = await this.issueRepository.findIssueCategoryById(
      input.cancelSubCategoryId
    );

    if ((subCategory.parentCategory).toLowerCase() !== (IssueParentCategory.CANCEL).toLowerCase()) {
      ErrorException(null, 'RIDES.INVALID_CANCEL_SUB_CATEGORY', HttpStatus.BAD_REQUEST);
    }


    if (!(subCategory.categoryForRole === IssueCategoryForRole.BOTH || subCategory.categoryForRole === userLoginAs as IssueCategoryForRole)) {
      ErrorException(null, 'RIDES.INVALID_CANCEL_SUB_CATEGORY', HttpStatus.BAD_REQUEST);

    }

    if ((subCategory.label.toLowerCase()) === 'other' && !input.cancelReasonContent) {
      ErrorException(null, 'RIDES.CANCEL_REASON_REQUIRED_FOR_OTHER', HttpStatus.BAD_REQUEST);
    }

    const isPassenger = ride.passengerId.toString() === user._id.toString();
    const isDriver = ride.driverId.toString() === user._id.toString();

    if (!isPassenger && !isDriver) {
      ErrorException(null, 'RIDES.CANCEL_UNAUTHORIZED', HttpStatus.FORBIDDEN);
    }

    if (ride.rideStatus === RideStatus.CANCELLED) {
      ErrorException(null, 'RIDES.CANCEL_ALREADY_CANCELLED', HttpStatus.BAD_REQUEST);
    }

    if (ride.rideStatus === RideStatus.COMPLETED) {
      ErrorException(null, 'RIDES.CANCEL_ALREADY_COMPLETED', HttpStatus.BAD_REQUEST);
    }

    if (ride.rideStatus === RideStatus.ONGOING) {
      ErrorException(null, 'RIDES.CANCEL_IN_PROGRESS', HttpStatus.BAD_REQUEST);
    }

    if (ride.rideStatus === RideStatus.PENDING) {
      ErrorException(null, 'RIDES.CANCEL_PENDING', HttpStatus.BAD_REQUEST);
    }

    return this.rideRepository.cancelRide({
      rideId: input.rideId,
      cancelledBy: user._id,
      cancelledByRole: userLoginAs as CategoryAccessedByRole,
      cancelSubCategoryId: toMongoId(input.cancelSubCategoryId), // Convert to ObjectId using
      cancelSubCategoryLabel: input.cancelSubCategoryLabel,
      cancelReasonContent: input.cancelReasonContent,
    });
  }

  async getOngoingRideWithDetails(rideId: string, userId: Types.ObjectId): Promise<any> {
    const rideDocument = await this.rideRepository.getOngoingRideWithDetails(
      rideId,
      userId,
    );
    if (!rideDocument)
      ErrorException(null, 'RIDES.RIDE_NOT_FOUND', HttpStatus.NOT_FOUND);
    const ride = rideDocument.toObject();

  
    transformToEntityNameObjectFromId(ride, ['vehicleId', 'vehicle']);


    const driverDetails = ride.driverId
      ? await this.userDetailsRepository.findOne(
        { userId: toMongoId(ride.driverId._id) },
        null,
        { fullName: 1, profileImage: 1, rating: 1 },
      )
      : null;

    const rideObject = {
      ...ride,
      _id: ride._id.toString(),
      driver: driverDetails
        ? {
          fullName: driverDetails.fullName,
          profileImage: driverDetails.profileImage || "",
          rating: Math.floor(Math.random() * 5) + 1 // Random rating between 1 and 5 for testing,
        }
        : null,
      ablyChannelId: `ride:${ride.rideUUId}`,
      driverChannelId: ride.driverChannelId || `D-${ride.rideUUId}-RIDE`,
      passengerChannelId: ride.passengerChannelId || `P-${ride.rideUUId}-RIDE`,
      driverLocationChannelId: ride.driverLocationChannelId || `D-LOCATION-${ride.rideUUId}`,
      passengerLocationChannelId: ride.passengerLocationChannelId || `P-LOCATION-${ride.rideUUId}`,
    };
    return rideObject;

  }
}

