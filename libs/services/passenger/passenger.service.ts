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
import {
  RiderRatingsInput,
  RiderTripsInput,
} from "@libs/data-access/dtos/input/passenger-admin.input";
import { PassengerListInput } from "@libs/data-access/dtos/input/passenger-list.input";
import {
  RiderOverviewResponse,
  RiderRatingsResponse,
  RiderTripsResponse,
} from "@libs/data-access/dtos/response/passenger-admin.response";
import { PassengerListItem } from "@libs/data-access/dtos/response/passenger-list.response";

import { UserDetailsRepository } from "@libs/data-access/repositories/user-detail.repository";
import { UserRepository } from "@libs/data-access/repositories/user.repository";
import { S3Service } from "@libs/s3";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class PassengerService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly s3: S3Service,
    private readonly ridesRepository: RidesRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
  ) {}

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

  async getRiderOverview(riderId: string): Promise<RiderOverviewResponse> {
    const userDoc = await this.userRepository.findById(toMongoId(riderId));
    if (!userDoc) throw new NotFoundException("Rider not found");

    const details = await this.userDetailsRepository.findOne(
      { userId: toMongoId(riderId) },
      null,
      { fullName: 1, profileImages: 1 },
    );

    return {
      id: riderId,
      fullName: details?.fullName || userDoc.fullName || "Rider",
      profileImage: getActiveProfileImageUrl(details?.profileImages, (key) =>
        this.s3.getPublicUrl(key),
      ),
      phone: userDoc.phone || "",
      email: userDoc.email || "",
      suspended: userDoc.suspended || false,
      joinedDate: userDoc.createdAt?.toDateString(),
      lastActive: (userDoc as any).lastActiveAt?.toISOString() ?? null,
      phoneVerified: (userDoc as any).phoneVerified ?? false,
    };
  }

  async getRiderTrips(input: RiderTripsInput): Promise<RiderTripsResponse> {
    const { riderId, page, limit, search, status, paymentMethod } = input;

    // totals come straight off the counters on UserDetails — same rule as the driver side
    const details = await this.userDetailsRepository.findOne(
      { userId: toMongoId(riderId) },
      null,
      { totalTripsAsPassenger: 1, totalSpendingOnRides: 1 },
    );

    const { data, pagination, completed, cancelled, avgFare } =
      await this.ridesRepository.getPassengerTrips(
        toMongoId(riderId),
        { page, limit },
        { search, status, paymentMethod },
      );

    return {
      data,
      averageRating: 4,
      totalReviews: 34,
      pagination: { ...pagination, hasNextPage: true, hasPreviousPage: true },
      summary: {
        totalTrips: details?.totalTripsAsPassenger ?? 0,
        completed,
        cancelled,
        totalSpend: details?.totalSpendingOnRides ?? 0,
        avgFare,
      },
    };
  }

  async getRiderRatings(
    input: RiderRatingsInput,
  ): Promise<RiderRatingsResponse> {
    const { riderId, page, limit } = input;

    // average + star breakdown are denormalized counters on UserDetails —
    // update them wherever a rating actually gets written, never compute here
    const details = await this.userDetailsRepository.findOne(
      { userId: toMongoId(riderId) },
      null,
      { rating: 1, ratingBreakdown: 1, totalReviews: 1 } as any,
    );

    const { data, pagination } = await this.ridesRepository.getRiderReviews(
      toMongoId(riderId),
      { page, limit },
    );

    return {
      averageRating: details?.rating ?? 0,
      totalReviews: (details as any)?.totalReviews ?? 0,
      breakdown: (details as any)?.ratingBreakdown ?? {
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
      },
      data,
      pagination: { ...pagination, hasNextPage: true, hasPreviousPage: false },
    };
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
