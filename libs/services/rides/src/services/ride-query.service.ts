import { Injectable } from "@nestjs/common";
import { HttpStatus } from "@nestjs/common";
import { Model, Types } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { S3Service } from "@libs/s3/s3.service";
import { ErrorException } from "@libs/common/exceptions";
import { toMongoId } from "@libs/common";
import { getActiveProfileImageUrl } from "@libs/common/utils/entity.utils";
import {
  RidesRepository,
  User,
  RidesDocument,
  RideStatus,
  roles,
  UserRepository,
  UserDetailsRepository,
  DriverDocumentRepository,
  Vehicle,
  VehicleDocument,
  UserDocument,
  UserDailyOnlineStatusRepository,
  AvailabilityRepository,
  GetAllRidesPaginationInput,
} from "@libs/data-access";
import { DriverDocumentBundleStatus } from "@libs/data-access/enums/driver-document.enum";
import { REQUIRED_SIDES } from "@libs/common";
import { DriverOnlineStatus, UserType } from "@libs/data-access";
import { RideDetailResponse } from "@libs/data-access/dtos/response/rides-list.response";
import { RideDetailInput } from "@libs/data-access/dtos/input/ride-detail.input";
import { TransactionService } from "@libs/services/payment/src/transaction/transaction.service";
import { WalletService } from "@libs/services/payment/src/wallet/wallet.service";

/**
 * Read-only ride queries: user-facing ride listing/detail/history queries
 * and the driver-trips-with-commission query.
 */
@Injectable()
export class RideQueryService {
  constructor(
    private readonly rideRepository: RidesRepository,
    private readonly userRepository: UserRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly driverDocumentRepository: DriverDocumentRepository,
    private readonly userDailyOnlineStatusRepository: UserDailyOnlineStatusRepository,
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly transactionService: TransactionService,
    private readonly s3: S3Service,
    private readonly walletService: WalletService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
  ) {}

  async findRides(user: User, options: GetAllRidesPaginationInput) {
    return this.rideRepository.findRidesByUserWithCursorPagination(
      user,
      options,
    );
  }

  async getDriverTripsWithCommission(
    driverId: string,
    filter: "ALL" | "DUE" | "PAID",
    page: number,
    limit: number,
  ) {
    const [result, walletAmount] = await Promise.all([
      this.rideRepository.getDriverTripsWithCommission(
        new Types.ObjectId(driverId),
        filter,
        page,
        limit,
      ),
      this.walletService.getBalance(driverId),
    ]);

    return {
      ...result,
      walletAmount,
    };
  }

  // userId can be of either driver or passenger
  async enlistRidesByDriverOrPassenger(
    userId: string,
    historyAs: UserType,
    options: GetAllRidesPaginationInput,
  ) {
    // get fullname and phone number and uuid for driver and passenger
    await this.userRepository.findById(toMongoId(userId));

    // return this.rideRepository.getRideHistoryOfIndividualRiderOrUser(
    //   user,
    //   options,
    // );
  }

  async homeDashboardApi(user: User): Promise<any> {
    const rides = await this.rideRepository.homeDashboardApi(user);
    const enrichedRides = await Promise.all(
      rides.map((ride) => this.enrichRideDetails(ride)),
    );

    // Passengers receive the standard ride list with null stats
    if (user.loginAs !== roles.RIDER) {
      return {
        rides: enrichedRides,
        verification: null,
        stats: {
          totalEarnings: null,
          totalTrips: null,
          rating: null,
          onlineHoursToday: null,
        },
        onlineStatus: null,
        vehicleStatus: null,
        ridePreference: null,
        isWeekAvailability: false,
      };
    }

    const userId = toMongoId(user._id.toString());

    // Availability: has the driver set any upcoming availability days?
    // (Rolling window — days are stored with their concrete date.)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const availability = await this.availabilityRepository.findByDriver(userId);
    const isWeekAvailability =
      !!availability &&
      (availability.days || []).some(
        (d) => d.date && new Date(d.date).getTime() >= todayStart.getTime(),
      );

    // Fetch Driver Data: Details (Rating, Online Status), Documents, and Vehicle
    const [details, docs, vehicle] = await Promise.all([
      this.userDetailsRepository.findOne({ userId }),
      this.driverDocumentRepository.find({ driverId: userId }),
      this.vehicleModel.findOne({ driverId: userId }).exec(),
    ]);

    // 1. Evaluate Document Upload Status
    const requiredTypes = Object.keys(REQUIRED_SIDES);
    const documentStatuses = requiredTypes.map((type: any) => {
      const doc = docs.find((d) => d.type === type);
      if (!doc)
        return { type, status: DriverDocumentBundleStatus.NOT_SUBMITTED };
      return { type, status: doc.status };
    });

    const verificationRequired = documentStatuses.some(
      (d) => d.status !== DriverDocumentBundleStatus.APPROVED,
    );

    // 2. Aggregate Earnings (Today)
    // Per requirement: Total earnings 0 if verification is required
    const earningsData = !verificationRequired
      ? await this.transactionService.getDriversEarningByDate(
          user._id.toString(),
        )
      : { netEarning: 0 };

    // 3. Total Trip History (Today only) — count completed rides today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const totalTrips = await this.rideRepository.count({
      driverId: userId,
      rideStatus: RideStatus.COMPLETED,
      $or: [
        { rideCompletedAt: { $gte: startOfToday, $lte: endOfToday } },
        {
          rideCompletedAt: null,
          bookingTime: { $gte: startOfToday, $lte: endOfToday },
        },
      ],
    });

    // 4. Online Hours Tracking (from UserDailyOnlineStatus)
    const today = new Date().toISOString().split("T")[0];
    const onlineRecord = await this.userDailyOnlineStatusRepository.findOne({
      userId: userId,
      date: today,
    });
    let totalOnlineSeconds = onlineRecord?.totalOnlineSeconds || 0;
    // If currently online, add elapsed time since lastOnlineAt
    if (
      details?.driverOnlineStatus === DriverOnlineStatus.ONLINE &&
      onlineRecord?.lastOnlineAt
    ) {
      totalOnlineSeconds += Math.floor(
        (Date.now() - onlineRecord.lastOnlineAt.getTime()) / 1000,
      );
    }
    const onlineMinutesToday = Math.floor(totalOnlineSeconds / 60);

    // Determine vehicle status
    const hasVehicle = !!vehicle;
    const finalVerificationRequired = verificationRequired || !hasVehicle;

    return {
      rides: enrichedRides,
      verification: {
        verificationRequired: finalVerificationRequired,
        documentStatuses,
      },
      stats: {
        totalEarnings: earningsData.netEarning,
        totalTrips,
        rating: details?.rating || 0,
        onlineHoursToday: (onlineMinutesToday / 60).toFixed(2),
      },
      onlineStatus: details?.driverOnlineStatus || DriverOnlineStatus.OFFLINE,
      vehicleStatus: hasVehicle,
      ridePreference: details?.ridePreference || null,
      isWeekAvailability,
    };
  }

  /**
   * Gets ride details by ID with all populated information (vehicle, driver, passenger).
   * Only the passenger who owns the ride can access it.
   */
  async getRideById(rideId: string, user: User): Promise<any> {
    const rideDocument =
      await this.rideRepository.findByIdWithAllDetails(rideId);
    if (!rideDocument) {
      ErrorException(null, "RIDES.RIDE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    if (user.loginAs === roles.USER) {
      if (rideDocument.passengerId._id.toString() !== user._id.toString()) {
        ErrorException(null, "RIDES.RIDE_NOT_FOUND", HttpStatus.NOT_FOUND);
      }
    }
    if (user.loginAs === roles.RIDER) {
      if (rideDocument.driverId._id.toString() !== user._id.toString()) {
        ErrorException(null, "RIDES.RIDE_NOT_FOUND", HttpStatus.NOT_FOUND);
      }
    }
    const enriched = await this.enrichRideDetails(rideDocument);
    const walletAmount = await this.walletService.getBalance(
      user._id.toString(),
    );
    return {
      ...enriched,
      rideCompletedAt: rideDocument.rideCompletedAt,
      rideEndedAt: rideDocument.rideEndedAt,
      walletAmount,
    };
  }

  async getRideByIdAdmin(id: string) {
    const ride = await this.rideRepository.findRideByIdAdmin(id);
    if (!ride) return null;

    return {
      ...ride,
      passenger: ride.passenger && {
        ...ride.passenger,
        profileImage: getActiveProfileImageUrl(
          ride.passenger.profileImages,
          (key) => this.s3.getPublicUrl(key),
        ),
      },
      driver: ride.driver && {
        ...ride.driver,
        profileImage: getActiveProfileImageUrl(
          ride.driver.profileImages,
          (key) => this.s3.getPublicUrl(key),
        ),
      },
    };
  }

  async getRideDetail(input: RideDetailInput) {
    const rideDocument =
      await this.rideRepository.findByIdWithFullDetailsForAdmin(input.id);

    if (!rideDocument) {
      ErrorException(null, "RIDES.RIDE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    return this.enrichRideDetailsForAdmin(rideDocument);
  }

  async getOngoingRideWithDetails(
    rideId: string,
    userId: Types.ObjectId,
  ): Promise<any> {
    const rideDocument = await this.rideRepository.getOngoingRideWithDetails(
      rideId,
      userId,
    );
    if (!rideDocument)
      ErrorException(null, "RIDES.RIDE_NOT_FOUND", HttpStatus.NOT_FOUND);

    return this.enrichRideDetails(rideDocument);
  }

  /**
   * Helper to enrich ride data with detailed driver and passenger information.
   */
  private async enrichRideDetails(rideDocument: RidesDocument): Promise<any> {
    const ride = rideDocument.toObject() as any;
    // Normalize Vehicle
    if (ride.vehicleId && typeof ride.vehicleId === "object") {
      ride.vehicle = ride.vehicleId;
      ride.vehicleId = ride.vehicleId._id.toString();
    }

    const formatSnapshot = async (
      userRef: any,
      fallbackName: string,
      includeLocationChannelId = false,
    ) => {
      if (!userRef) return null;
      const isPopulated = typeof userRef === "object" && userRef._id;
      const userId = isPopulated ? userRef._id.toString() : userRef.toString();
      const baseData = isPopulated ? userRef : {};

      const details = await this.userDetailsRepository.findOne(
        { userId: toMongoId(userId) },
        null,
        {
          fullName: 1,
          profileImages: 1,
          rating: 1,
          locationChannelId: 1,
          geoLocation: 1,
        },
      );

      const combined = { ...baseData, ...details?.toObject() };
      const result: any = {
        fullName: combined.fullName || baseData.fullName || fallbackName,
        profileImage: getActiveProfileImageUrl(combined.profileImages, (key) =>
          this.s3.getPublicUrl(key),
        ),
        rating: combined.rating ?? 0,
        phone: combined.phone || baseData.phone || "",
      };
      if (includeLocationChannelId) {
        result.locationChannelId = combined.locationChannelId;
        result.geoLocation = combined?.geoLocation || null;
      }
      return result;
    };

    const [driver, passenger] = await Promise.all([
      formatSnapshot(ride.driverId, "Driver", true),
      formatSnapshot(ride.passengerId, "Passenger", false),
    ]);

    if (ride.passengerId && typeof ride.passengerId === "object")
      ride.passengerId = ride.passengerId._id.toString();
    if (ride.driverId && typeof ride.driverId === "object")
      ride.driverId = ride.driverId._id.toString();

    if (!ride.vehicle && ride.vehicleId && typeof ride.vehicleId === "object") {
      ride.vehicle = ride.vehicleId;
      ride.vehicleId = ride.vehicleId._id.toString();
    }

    return {
      ...ride,
      _id: ride._id.toString(),
      driver,
      passenger,
      ablyChannelId:
        ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`,
    };
  }

  private enrichRideDetailsForAdmin(rideDocument: RidesDocument): any {
    const ride = rideDocument.toObject() as any;

    const formatAdminSnapshot = (userDoc: any, role: "driver" | "passenger") => {
      if (!userDoc) return null;

      const details = userDoc.userDetails || {};
      const displayId =
        role === "driver"
          ? details.displayIdAsDriver
          : details.displayIdAsPassenger;

      return {
        userId: userDoc._id.toString(),
        fullName: details.fullName || userDoc.name || "",
        displayId: displayId || "—",
        email: userDoc.email || "",
        phone: userDoc.phone || "",
        profileImage: getActiveProfileImageUrl(details.profileImages, (key) =>
          this.s3.getPublicUrl(key),
        ),
        rating: details.rating ?? 0,
        suspended: userDoc.suspended ?? false,
        totalTripsAsPassenger: details.totalTripsAsPassenger,
        totalRidesAsDriver: details.totalRidesAsDriver,
      };
    };

    const driver = formatAdminSnapshot(ride.driverId, "driver");
    const passenger = formatAdminSnapshot(ride.passengerId, "passenger");

    const totalAmount = ride.paymentDetails?.totalAmount ?? 0;
    const commissionRate = ride.paymentDetails?.driverCommission ?? 0.2;
    const platformCommissionAmount = totalAmount * commissionRate;

    return {
      id: ride._id.toString(),
      rideUUId: ride.rideUUId,
      rideType: ride.rideType,
      rideStatus: ride.rideStatus,
      bookingTime: ride.bookingTime,
      rideStartedAt: ride.rideStartedAt,
      rideCompletedAt: ride.rideCompletedAt,
      pickupLocation: ride.pickupLocation,
      dropoffLocation: ride.dropoffLocation,
      distanceInKm: ride.distanceInKm,
      durationInMinutes:
        ride.actualCompletedDurationInMinutes || ride.estimatedTimeInMinutes,
      waitTimeInMinutes: ride.timeToReachPassengerInMinutes,
      fare: ride.fare,
      paymentDetails: ride.paymentDetails,
      platformCommissionAmount,
      driverEarningsAmount: totalAmount - platformCommissionAmount,
      vehicle: typeof ride.vehicleId === "object" ? ride.vehicleId : undefined,
      driver,
      passenger,
    };
  }
}