import { toMongoId } from "@libs/common";
import { getActiveProfileImageUrl } from "@libs/common/utils/entity.utils";
import {
  BasicResponse,
  IPaginatedResult,
  RidesRepository,
  RideStatus,
  Transaction,
  TransactionRepository,
} from "@libs/data-access";
import { PassengerListInput } from "@libs/data-access/dtos/input/passenger-list.input";
import { PassengerListItem } from "@libs/data-access/dtos/response/passenger-list.response";

import { UserDetailsRepository } from "@libs/data-access/repositories/user-detail.repository";
import { UserRepository } from "@libs/data-access/repositories/user.repository";
import { S3Service } from "@libs/s3";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class PassengerService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly transactionRepository: TransactionRepository, // Replace with actual TransactionRepository type
    private readonly ridesRepository: RidesRepository, // Replace with actual RidesRepository type
    private readonly s3: S3Service,
  ) {}

  //   private async enrichDataPassengerWithRideDetails(driverId: string) {
  //     //we need to query the rides collection to get the ride details for the driver and return it as part of the driver object
  //     const totalRidesPromise = this.ridesRepository.count({
  //       driverId: toMongoId(driverId),
  //       rideStatus: RideStatus.COMPLETED,
  //     });
  //     const totalEarningsPromise =
  //       this.transactionRepository.totalEarningsByPassengerId(driverId);
  //     // You can add more ride-related details as needed
  //     // Implement logic to fetch and enrich driver with ride-related information if needed
  //     const driverLastTripPromise = this.ridesRepository.findOne(
  //       { driverId: toMongoId(driverId) },
  //       null,
  //       { sort: { createdAt: -1 } },
  //     );
  //     const [totalRides, totalEarnings, driverLastTrip] = await Promise.all([
  //       totalRidesPromise,
  //       totalEarningsPromise,
  //       driverLastTripPromise,
  //     ]);

  //     return {
  //       totalRides: totalRides,
  //       totalEarnings: totalEarnings,
  //       lastTripAt: driverLastTrip.createdAt?.toISOString() || null,
  //       lastTripDuration: driverLastTrip.actualCompletedDurationInMinutes || null,
  //       lastTripStartTime: driverLastTrip?.rideStartedAt.toDateString() || "",
  //       lastTripEndTime: driverLastTrip?.rideCompletedAt.toDateString() || "",
  //     };
  //   }

  //   async getPassengerDetails(driverId: string): Promise<PassengerWDocuments> {
  //     const userDoc = await this.userRepository.findById(toMongoId(driverId));
  //     if (!userDoc) {
  //       throw new NotFoundException("Passenger not found");
  //     }

  //     const details = await this.userDetailsRepository.findOne(
  //       { userId: toMongoId(driverId) },
  //       null,
  //       {
  //         fullName: 1,
  //         profileImages: 1,
  //         rating: 1,
  //         locationChannelId: 1,
  //         geoLocation: 1,
  //       },
  //     );

  //     const documents =
  //       await this.driverDocumentRepository.getPassengerDocuments(driverId);

  //     const driverEnrichedWithRideDetails =
  //       await this.enrichDataPassengerWithRideDetails(driverId);
  //     return {
  //       id: driverId,
  //       fullName: details?.fullName || userDoc.fullName || "Passenger",
  //       profileImage: getActiveProfileImageUrl(details?.profileImages, (key) =>
  //         this.s3.getPublicUrl(key),
  //       ),
  //       amountDueToCompany: details?.amountDueToCompany ?? 0,
  //       rating: details?.rating ?? 0,
  //       phone: userDoc.phone || "",
  //       dateOfBirth: details?.dateOfBirth?.toISOString() || null,
  //       email: userDoc.email || "",
  //       suspended: userDoc.suspended || false,
  //       address: details?.address || "",
  //       locationChannelId: details?.locationChannelId ?? null,
  //       documents: documents ?? [],
  //       joinedDate: userDoc.createdAt.toDateString(),
  //       ...driverEnrichedWithRideDetails,
  //     };
  //   }

  async listPassengers(
    input: PassengerListInput,
  ): Promise<IPaginatedResult<PassengerListItem>> {
    const { page, limit, search, status } = input;

    const result = await this.userRepository.getPassengersList(
      { page, limit },
      status,
      search,
    );

    const data: PassengerListItem[] = result.data.map((row: any) => ({
      id: row.id?.toString(),
      fullName: row.fullName || "Passenger",
      phone: row.phone || "",
      status: row.status,
      profileImage: getActiveProfileImageUrl(row.profileImages, (key) =>
        this.s3.getPublicUrl(key),
      ),
      suspended: row.suspended,
      totalTripsAsPassenger: row.totalTripsAsPassenger,
      totalSpendingOnRides: row.totalSpendingOnRides,
      rating: row.rating,
      joinedDate: row.createdAt ? new Date(row.createdAt).toDateString() : null,
    }));

    return { data, pagination: result.pagination };
  }

  async softDeletePassenger(driverId: string): Promise<boolean> {
    const driver = await this.userRepository.findById(toMongoId(driverId));
    if (!driver) {
      throw new NotFoundException("Passenger not found");
    }

    await this.userRepository.softDeleteById(toMongoId(driverId));
    return true;
  }

  async setSuspended(
    id: string,
    suspended: boolean,
  ): Promise<Pick<PassengerListItem, "id" | "suspended">> {
    const driver = await this.userRepository.findById(toMongoId(id));
    if (!driver) {
      throw new NotFoundException(`Passenger ${id} not found`);
    }

    // atomic update — avoids the read-modify-write TOCTOU gap
    // you've been digging into on Labasam; same concern applies here
    const updated = await this.userRepository.findOneAndUpdate(
      { _id: toMongoId(id) },
      { suspended },
      { new: true }, // return the doc *after* update, not before
    );

    if (!updated) {
      throw new NotFoundException(`Passenger ${id} not found`);
    }

    return { id: updated._id.toString(), suspended: updated.suspended };
  }
}
