import { toMongoId } from "@libs/common";
import { getActiveProfileImageUrl } from "@libs/common/utils/entity.utils";
import {
  IPaginatedResult,
  RidesRepository,
  RideStatus,
  Transaction,
  TransactionRepository,
} from "@libs/data-access";
import { DriverListInput } from "@libs/data-access/dtos/input/driver-list.input";
import { DriverListItem } from "@libs/data-access/dtos/response/driver-list.response";
import { DriverWDocuments } from "@libs/data-access/dtos/response/driver-w-documents.response";
import { DriverDocumentRepository } from "@libs/data-access/repositories/driver-document.repository";
import { UserDetailsRepository } from "@libs/data-access/repositories/user-detail.repository";
import { UserRepository } from "@libs/data-access/repositories/user.repository";
import { S3Service } from "@libs/s3";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class DriverService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly driverDocumentRepository: DriverDocumentRepository,
    private readonly transactionRepository: TransactionRepository, // Replace with actual TransactionRepository type
    private readonly ridesRepository: RidesRepository, // Replace with actual RidesRepository type
    private readonly s3: S3Service,
  ) {}

  private async enrichDataDriverWithRideDetails(driverId: string) {
    //we need to query the rides collection to get the ride details for the driver and return it as part of the driver object
    const totalRidesPromise = this.ridesRepository.count({
      driverId: toMongoId(driverId),
      rideStatus: RideStatus.COMPLETED,
    });
    const totalEarningsPromise =
      this.transactionRepository.totalEarningsByDriverId(driverId);
    // You can add more ride-related details as needed
    // Implement logic to fetch and enrich driver with ride-related information if needed
    const driverLastTripPromise = this.ridesRepository.findOne(
      { driverId: toMongoId(driverId) },
      null,
      { sort: { createdAt: -1 } },
    );
    const [totalRides, totalEarnings, driverLastTrip] = await Promise.all([
      totalRidesPromise,
      totalEarningsPromise,
      driverLastTripPromise,
    ]);

    return {
      totalRides: totalRides,
      totalEarnings: totalEarnings,
      lastTripAt: driverLastTrip.createdAt?.toISOString() || null,
      lastTripDuration: driverLastTrip.actualCompletedDurationInMinutes || null,
      lastTripStartTime: driverLastTrip?.rideStartedAt.toDateString() || "",
      lastTripEndTime: driverLastTrip?.rideCompletedAt.toDateString() || "",
    };
  }

  async getDriverDetails(driverId: string): Promise<DriverWDocuments> {
    const userDoc = await this.userRepository.findById(toMongoId(driverId));
    if (!userDoc) {
      throw new NotFoundException("Driver not found");
    }

    const details = await this.userDetailsRepository.findOne(
      { userId: toMongoId(driverId) },
      null,
      {
        fullName: 1,
        profileImages: 1,
        rating: 1,
        locationChannelId: 1,
        geoLocation: 1,
      },
    );

    const documents =
      await this.driverDocumentRepository.getDriverDocuments(driverId);

    const driverEnrichedWithRideDetails =
      await this.enrichDataDriverWithRideDetails(driverId);
    return {
      id: driverId,
      fullName: details?.fullName || userDoc.fullName || "Driver",
      profileImage: getActiveProfileImageUrl(details?.profileImages, (key) =>
        this.s3.getPublicUrl(key),
      ),
      amountDueToCompany: details?.amountDueToCompany ?? 0,
      rating: details?.rating ?? 0,
      phone: userDoc.phone || "",
      dateOfBirth: details?.dateOfBirth?.toISOString() || null,
      email: userDoc.email || "",
      suspended: userDoc.suspended || false,
      address: details?.address || "",
      locationChannelId: details?.locationChannelId ?? null,
      documents: documents ?? [],
      joinedDate: userDoc.createdAt.toDateString(),
      ...driverEnrichedWithRideDetails,
    };
  }

  async listDrivers(
    input: DriverListInput,
  ): Promise<IPaginatedResult<DriverListItem>> {
    const { page, limit, search, status } = input;

    const result = await this.userRepository.getDriverList(
      { page, limit },
      status,
      search,
    );

    const data: DriverListItem[] = result.data.map((row: any) => ({
      id: row.id?.toString(),
      fullName: row.fullName || "Driver",
      phone: row.phone || "",
      status: row.status,
      profileImage: getActiveProfileImageUrl(row.profileImages, (key) =>
        this.s3.getPublicUrl(key),
      ),
      totalRides: row.totalRides,
      totalEarnings: row.totalEarnings,
      rating: row.rating,
      joinedDate: row.createdAt ? new Date(row.createdAt).toDateString() : null,
    }));

    return { data, pagination: result.pagination };
  }
}
