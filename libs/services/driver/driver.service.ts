import { toMongoId } from "@libs/common";
import { getActiveProfileImageUrl } from "@libs/common/utils/entity.utils";
import {
  BasicResponse,
  IPaginatedResult,
  RidesRepository,
  RideStatus,
  Transaction,
  TransactionRepository,
  UserDetails,
  UserDetailsDocument,
} from "@libs/data-access";
import { DriverListInput } from "@libs/data-access/dtos/input/driver-list.input";
import { DriverCommissionSummary } from "@libs/data-access/dtos/response/driver-commission-summary.response";
import { DriverListItem } from "@libs/data-access/dtos/response/driver-list.response";
import { DriverWDocuments } from "@libs/data-access/dtos/response/driver-w-documents.response";
import { DriverDocumentRepository } from "@libs/data-access/repositories/driver-document.repository";
import { UserDetailsRepository } from "@libs/data-access/repositories/user-detail.repository";
import { UserRepository } from "@libs/data-access/repositories/user.repository";
import { S3Service } from "@libs/s3";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";

@Injectable()
export class DriverService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly driverDocumentRepository: DriverDocumentRepository,
    private readonly transactionRepository: TransactionRepository, // Replace with actual TransactionRepository type
    private readonly ridesRepository: RidesRepository, // Replace with actual RidesRepository type
    private readonly s3: S3Service,
    @InjectModel(UserDetails.name)
    private readonly userdetailsModel: Model<UserDetailsDocument>,
  ) {}

  private async enrichDataDriverWithRideDetails(driverId: string) {
    // You can add more ride-related details as needed
    // Implement logic to fetch and enrich driver with ride-related information if needed
    const driverLastTripPromise = this.ridesRepository.findOne(
      { driverId: toMongoId(driverId) },
      null,
      { sort: { createdAt: -1 } },
    );
    const [driverLastTrip] = await Promise.all([driverLastTripPromise]);

    return {
      lastTripAt: driverLastTrip?.createdAt?.toISOString() ?? null,
      lastTripDuration:
        driverLastTrip?.actualCompletedDurationInMinutes ?? null,
      lastTripStartTime: driverLastTrip?.rideStartedAt?.toDateString() ?? null,

      lastTripEndTime: driverLastTrip?.rideCompletedAt?.toDateString() ?? null,
    };
  }

  async getDriverTrips(
    driverId: string,
    pageInput: { page?: number; limit?: number },
    filters: {
      search?: string;
      status?: string;
      orderBy?: string;
      order?: string;
    },
  ) {
    return this.ridesRepository.getDriverTrips(
      new Types.ObjectId(driverId),
      pageInput,
      filters,
    );
  }

  async getDriverCommissionSummary(
    driverId: string,
  ): Promise<DriverCommissionSummary> {
    const userDetails = await this.userdetailsModel
      .findOne({ userId: new Types.ObjectId(driverId) })
      .lean();

    return {
      outstandingToPay: userDetails?.amountDueToCompany ?? 0,
      commissionPaid: null,
      totalRides: userDetails?.totalRidesAsDriver ?? 0,
      lastSettlementDate: null,
      lastSettlementAmount: null,
      lastSettlementMethod: null,
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
        totalRidesAsDriver: 1,
        totalEarnings: 1,
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
      dateOfBirth: details?.dateOfBirth?.toDateString() || null,
      email: userDoc.email || "",
      suspended: userDoc.suspended || false,
      address: details?.address || "",
      locationChannelId: details?.locationChannelId ?? null,
      documents: documents ?? [],
      joinedDate: userDoc?.createdAt?.toDateString(),
      totalRidesAsDriver: details?.totalRidesAsDriver ?? 0,
      totalEarnings: details?.totalEarnings ?? 0,
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

    const data: DriverListItem[] = result.data.map((row: any) => {
      return {
        id: row.id?.toString(),
        fullName: row.fullName || "Driver",
        phone: row.phone || "",
        status: row.status,
        profileImage: getActiveProfileImageUrl(row.profileImages, (key) =>
          this.s3.getPublicUrl(key),
        ),
        suspended: row.suspended,
        totalRidesAsDriver: row.totalRidesAsDriver,
        totalEarnings: row.totalEarnings,
        rating: row.rating,
        joinedDate: row.createdAt
          ? new Date(row.createdAt)?.toDateString()
          : null,
      };
    });

    return { data, pagination: result.pagination };
  }

  async softDeleteDriver(driverId: string): Promise<boolean> {
    const driver = await this.userRepository.findById(toMongoId(driverId));
    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    await this.userRepository.softDeleteById(toMongoId(driverId));
    return true;
  }

  async setSuspended(
    id: string,
    suspended: boolean,
  ): Promise<Pick<DriverListItem, "id" | "suspended">> {
    const driver = await this.userRepository.findById(toMongoId(id));
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }

    // atomic update — avoids the read-modify-write TOCTOU gap
    // you've been digging into on Labasam; same concern applies here
    const updated = await this.userRepository.findOneAndUpdate(
      { _id: toMongoId(id) },
      { suspended },
      { new: true }, // return the doc *after* update, not before
    );

    if (!updated) {
      throw new NotFoundException(`Driver ${id} not found`);
    }

    return { id: updated._id.toString(), suspended: updated.suspended };
  }
}
