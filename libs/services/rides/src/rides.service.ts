import { PaginationInput, RidesRepository, User, RidesDocument, RideStatus, RideTypes, ProvinceEnum, roles, UserDetailsRepository, DiscountTypeEnum, PromoCodeStatusEnum, PromoCode, PromoCodeUsed, PromoCodeDocument, PromoCodeUsedDocument } from '@libs/data-access';
import { Model, Types } from 'mongoose';
import {  HttpStatus, Injectable } from '@nestjs/common';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { ErrorException } from '@libs/common/exceptions';
import { CancelRideInput } from '@libs/data-access/dtos/input/cancel-ride.input';
import { UpdateRideInput } from '@libs/data-access/dtos/input/update-ride.input';
import { IssueRepository } from '@libs/data-access/repositories/issue.repository';
import { CategoryAccessedByRole, IssueCategoryForRole, IssueParentCategory } from '@libs/data-access/enums/issue.enum';
import { toMongoId } from '@libs/common';
import { transformToEntityNameObjectFromId } from '@libs/common/utils/entity.utils';
import { InjectModel } from '@nestjs/mongoose';
@Injectable()
export class RidesService {
  constructor(
    private readonly rideRepository: RidesRepository,
    private readonly transactionService: TransactionService,
    private readonly issueRepository: IssueRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    @InjectModel(PromoCode.name) private readonly promoCodeModel: Model<PromoCodeDocument>,
    @InjectModel(PromoCodeUsed.name) private readonly promoCodeUsedModel: Model<PromoCodeUsedDocument>,
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

  /**
   * Gets ride details by ID with all populated information (vehicle, driver, passenger).
   * Only the passenger who owns the ride can access it.
   */
  async getRideById(rideId: string, userId: Types.ObjectId): Promise<any> {
    const rideDocument = await this.rideRepository.findByIdWithAllDetails(rideId);

    if (!rideDocument) {
      ErrorException(null, 'RIDES.RIDE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const ride = rideDocument.toObject() as any;

    // Verify that the user is the passenger of this ride
    if (ride.passengerId._id.toString() !== userId.toString()) {
      ErrorException(null, 'RIDES.RIDE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    transformToEntityNameObjectFromId(ride, ['vehicleId', 'vehicle']);

    // Fetch detailed driver information
    const driverDetails = ride.driverId
      ? await this.userDetailsRepository.findOne(
          { userId: toMongoId(ride.driverId._id.toString()) },
          null,
          {
            fullName: 1,
            profileImage: 1,
            rating: 1,
          },
        )
      : null;

    // Fetch detailed passenger information
    const passengerDetails = ride.passengerId
      ? await this.userDetailsRepository.findOne(
          { userId: toMongoId(ride.passengerId._id.toString()) },
          null,
          {
            fullName: 1,
            profileImage: 1,
            rating: 1,
          },
        )
      : null;

    return {
      ...ride,
      _id: ride._id.toString(),
      driver: driverDetails
        ? {
            fullName: driverDetails.fullName || ride.driverId.fullName || 'Driver',
            profileImage: driverDetails.profileImage || '',
            rating: driverDetails.rating ?? 0,
            phone: ride.driverId.phone,
          }
        : null,
      passenger: passengerDetails
        ? {
            fullName: passengerDetails.fullName || ride.passengerId.fullName || 'Passenger',
            profileImage: passengerDetails.profileImage || '',
            phone: ride.passengerId.phone,
            rating: passengerDetails.rating ?? 0,
          }
        : null,
    };
  }

  /**
   * Updates an upcoming confirmed ride's booking time, pickup location, and/or dropoff location.
   * Only rides with rideStatus CONFIRMED and bookingTime in the future can be updated.
   * Returns the updated ride document with a localized message.
   */
  async updateRide(
    user: User,
    input: UpdateRideInput,
  ): Promise<any> {
    // Find the upcoming confirmed ride for this passenger
    const existingRide = await this.rideRepository.findUpcomingConfirmedRideById(
      input.rideId,
      user,
    );

    if (!existingRide) {
      ErrorException(
        null,
        'RIDES.UPDATE_RIDE_NOT_FOUND',
        HttpStatus.NOT_FOUND,
      );
    }

    // Build update data - only include fields that are provided
    const updateData: {
      bookingTime?: Date;
      pickupLocation?: any;
      dropoffLocation?: any;
    } = {};

    if (input.bookingTime) {
      updateData.bookingTime = input.bookingTime;
    }

    if (input.pickupLocation) {
      updateData.pickupLocation = {
        type: 'Point',
        coordinates: [
          input.pickupLocation.longitude,
          input.pickupLocation.latitude,
        ],
        address: input.pickupLocation.address,
        city: input.pickupLocation.city || '',
        province: input.pickupLocation.province || ProvinceEnum.BAGMATI,
        district: input.pickupLocation.district || '',
        fullAddress: input.pickupLocation.fullAddress,
      };
    }

    if (input.dropoffLocation) {
      updateData.dropoffLocation = {
        type: 'Point',
        coordinates: [
          input.dropoffLocation.longitude,
          input.dropoffLocation.latitude,
        ],
        address: input.dropoffLocation.address,
        city: input.dropoffLocation.city || '',
        province: input.dropoffLocation.province || ProvinceEnum.BAGMATI,
        district: input.dropoffLocation.district || '',
        fullAddress: input.dropoffLocation.fullAddress,
      };
    }

    const updatedRide = await this.rideRepository.updateUpcomingConfirmedRide(
      input.rideId,
      user,
      updateData,
    );

    if (!updatedRide) {
      ErrorException(
        null,
        'RIDES.UPDATE_RIDE_FAILED',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ride = updatedRide.toObject() as any;
    transformToEntityNameObjectFromId(ride, ['vehicleId', 'vehicle']);

    return {
      _id: ride._id.toString(),
      ride: {
        ...ride,
        _id: ride._id.toString(),
      },
      message: 'RIDES.UPDATE_RIDE_SUCCESS',
    };
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
          fullName: driverDetails.fullName || ride.driverId?.fullName || "Driver",
          profileImage: driverDetails.profileImage || "",
          rating: driverDetails.rating ?? 0,
          phone: ride.driverId?.phone
        }
        : null,
      ablyChannelId: ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`,
    };
    return rideObject;

  }

  async applyPromoCode(user: User, rideId: string, promoCodeId: string): Promise<any> {
    const ride = await this.rideRepository.findById(toMongoId(rideId));
    if (!ride || ride.passengerId.toString() !== user._id.toString()) {
      ErrorException(null, 'RIDES.RIDE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const promo = await this.promoCodeModel.findById(toMongoId(promoCodeId)).exec();
    if (!promo || promo.status !== PromoCodeStatusEnum.ACTIVE || promo.expiryDateTime < new Date()) {
      ErrorException(null, 'RIDES.PROMO_CODE_NOT_FOUND', HttpStatus.BAD_REQUEST);
    }

    // Check perUserLimit
    const usageCount = await this.promoCodeUsedModel.countDocuments({
      userId: user._id,
      promoCodeId: promo._id
    });

    if (usageCount >= promo.perUserLimit) {
      ErrorException(null, 'RIDES.PROMO_LIMIT_REACHED', HttpStatus.BAD_REQUEST);
    }

    // Check minimum fare
    if (ride.estimatedFare < (promo.minimumFare || 0)) {
      ErrorException(null, 'RIDES.MIN_FARE_NOT_MET', HttpStatus.BAD_REQUEST);
    }

    // Calculate discount
    let discount = 0;
    if (promo.discountType === DiscountTypeEnum.PERCENTAGE) {
      discount = ride.estimatedFare * ((promo.percentageAmount || 0) / 100);
      if (promo.maxDiscount && discount > promo.maxDiscount) {
        discount = promo.maxDiscount;
      }
    } else {
      discount = promo.flatAmount || 0;
    }

    // Update ride
    const updatedRide = await this.rideRepository.findOneAndUpdate(
      { _id: ride._id },
      {
        $set: {
          estimatedFare: Math.max(0, ride.estimatedFare - discount),
          'fare.discountAmount': discount,
          'fare.promoCodeId': promo._id
        }
      },
      { new: true }
    );

    // Create usage record
    await this.promoCodeUsedModel.create({
      userId: user._id,
      promoCodeId: promo._id,
      rideId: ride._id
    });

    const rideObj = updatedRide.toObject() as any;
    transformToEntityNameObjectFromId(rideObj, ['vehicleId', 'vehicle']);

    return {
      message: 'RIDES.PROMO_APPLIED',
      success: true,
      ride: rideObj
    };
  }

  async removePromoCode(user: User, rideId: string): Promise<any> {
    const ride = await this.rideRepository.findById(toMongoId(rideId));
    if (!ride || ride.passengerId.toString() !== user._id.toString()) {
      ErrorException(null, 'RIDES.RIDE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (!ride.fare || !ride.fare['promoCodeId']) {
      return { success: true, message: 'RIDES.PROMO_REMOVED' };
    }

    const discountAmount = ride.fare['discountAmount'] || 0;
    const promoId = ride.fare['promoCodeId'];

    // Update ride - revert estimated fare and clear fields
    const updatedRide = await this.rideRepository.findOneAndUpdate(
      { _id: ride._id },
      {
        $set: {
          estimatedFare: ride.estimatedFare + discountAmount,
          'fare.discountAmount': 0,
          'fare.promoCodeId': null
        }
      },
      { new: true }
    );

    // Delete usage record
    await this.promoCodeUsedModel.deleteOne({
      rideId: ride._id,
      promoCodeId: promoId,
      userId: user._id
    });

    const rideObj = updatedRide.toObject() as any;
    transformToEntityNameObjectFromId(rideObj, ['vehicleId', 'vehicle']);

    return {
      message: 'RIDES.PROMO_REMOVED',
      success: true,
      ride: rideObj
    };
  }
}
