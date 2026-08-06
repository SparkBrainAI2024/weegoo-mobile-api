import { Injectable, Logger } from "@nestjs/common";
import { BaseRepository, Populate } from "../base/base.repository";
import { InjectModel } from "@nestjs/mongoose";
import { Rides, RidesDocument } from "../entities/rides.entity";
import { BaseModel } from "../base/base.model";
import { User } from "../entities/user.entity";
import {
  GetAllRidesPaginationInput,
  RideFilterStatus,
  RideSortBy,
} from "../dtos/input/get-all-rides.input";
import { roles } from "../enums/user.enum";
import { Types } from "mongoose";
import { RideStatus } from "../enums/rides.enum";
import { DriverTripCommissionFilter } from "../dtos/input/get-driver-trips.input";
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from "../enums/transaction.enum";
import { CategoryAccessedByRole } from "../enums/issue.enum";
import { Rating, RatingDocument } from "../entities/rating.entity";
import { RidesListInput, RideTimeRange } from "../dtos/input/rides-list.input";
interface CancelRideParams {
  rideId: string;
  cancelledBy: Types.ObjectId;
  cancelledByRole: CategoryAccessedByRole;
  cancelSubCategoryId: Types.ObjectId;
  cancelSubCategoryLabel: string;
  cancelReasonContent?: string;
}

const TIME_RANGE_MS: Record<RideTimeRange, number> = {
  [RideTimeRange.LAST_24_HOURS]: 24 * 60 * 60 * 1000,
  [RideTimeRange.LAST_7_DAYS]: 7 * 24 * 60 * 60 * 1000,
  [RideTimeRange.LAST_30_DAYS]: 30 * 24 * 60 * 60 * 1000,
};
@Injectable()
export class RidesRepository extends BaseRepository<RidesDocument> {
  private readonly logger = new Logger(RidesRepository.name);
  constructor(
    @InjectModel(Rides.name) private readonly _model: BaseModel<RidesDocument>,
    @InjectModel(Rating.name)
    private readonly ratingModel: BaseModel<RatingDocument>,
  ) {
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

  async getPassengerTrips(
    passengerId: Types.ObjectId,
    pageInput: { page?: number; limit?: number },
    filters: { search?: string; status?: string; paymentMethod?: string },
  ) {
    const match: Record<string, any> = { passengerId };
    if (filters.status) match.rideStatus = filters.status;
    if (filters.paymentMethod)
      match["paymentDetails.method"] = filters.paymentMethod;
    if (filters.search) {
      match.$or = [
        { rideUUId: { $regex: filters.search, $options: "i" } },
        { "pickupLocation.address": { $regex: filters.search, $options: "i" } },
        {
          "dropoffLocation.address": { $regex: filters.search, $options: "i" },
        },
      ];
    }

    const page = pageInput.page ?? 0;
    const limit = pageInput.limit ?? 10;

    // single round trip: page of rows + completed/cancelled counts + avg fare,
    // all via $facet instead of four separate queries
    const [result] = await this.model.aggregate([
      { $match: match },
      {
        $project: {
          id: "$_id",
          rideUUId: 1,
          createdAt: {
            $dateToString: {
              date: "$createdAt",
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
            },
          },
          pickupLocation: "$pickupLocation.address",
          dropoffLocation: "$dropoffLocation.address",
          fare: { $ifNull: ["$fare.totalFare", 0] },
          paymentMethod: "$paymentDetails.method",
          status: "$rideStatus",
        },
      },
      {
        $facet: {
          paginatedResults: [
            { $sort: { createdAt: -1 } },
            { $skip: page * limit },
            { $limit: limit },
          ],
          totalCount: [{ $count: "count" }],
          completedCount: [
            { $match: { status: RideStatus.COMPLETED } },
            { $count: "count" },
          ],
          cancelledCount: [
            { $match: { status: RideStatus.CANCELLED } },
            { $count: "count" },
          ],
          avgFare: [{ $group: { _id: null, avg: { $avg: "$fare" } } }],
        },
      },
    ]);

    const total = result?.totalCount?.[0]?.count ?? 0;

    return {
      data: result?.paginatedResults ?? [],
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      completed: result?.completedCount?.[0]?.count ?? 0,
      cancelled: result?.cancelledCount?.[0]?.count ?? 0,
      avgFare: Math.round(result?.avgFare?.[0]?.avg ?? 0),
    };
  }

  async getDriverTrips(
    driverId: Types.ObjectId,
    pageInput: { page?: number; limit?: number },
    filters: {
      search?: string;
      status?: string;
      orderBy?: string;
      order?: string;
    },
  ) {
    const match: Record<string, any> = { driverId };
    if (filters.status) match.rideStatus = filters.status;

    const sortField = filters.orderBy || "createdAt";
    const sortDirection = filters.order === "asc" ? 1 : -1;

    if (filters.search) {
      match.$or = [
        { rideUUId: { $regex: filters.search, $options: "i" } },
        { "pickupLocation.address": { $regex: filters.search, $options: "i" } },
        {
          "dropoffLocation.address": { $regex: filters.search, $options: "i" },
        },
      ];
    }

    const page = pageInput.page ?? 0;
    const limit = pageInput.limit ?? 10;

    const [result] = await this.model.aggregate([
      { $match: match },
      {
        $project: {
          id: "$_id",
          status: "$rideStatus",
          rideUUId: 1,
          createdAt: {
            $dateToString: {
              date: "$createdAt",
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
            },
          },
          pickupLocation: "$pickupLocation.address",
          dropoffLocation: "$dropoffLocation.address",
          fare: { $ifNull: ["$fare.totalFare", 0] },
          paymentMethod: "$paymentDetails.paymentMethod",
          driverCommission: "$paymentDetails.driverCommission",
          driverGets: {
            $subtract: [
              { $ifNull: ["$fare.totalFare", 0] },
              { $ifNull: ["$paymentDetails.driverCommission", 0] },
            ],
          },
        },
      },
      {
        $facet: {
          paginatedResults: [
            { $sort: { [sortField]: sortDirection } },
            { $skip: page * limit },
            { $limit: limit },
          ],
          totalCount: [{ $count: "count" }],
          avgFare: [{ $group: { _id: null, avg: { $avg: "$fare" } } }],
        },
      },
    ]);

    const total = result?.totalCount?.[0]?.count ?? 0;

    return {
      data: result?.paginatedResults ?? [],
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      avgFare: Math.round(result?.avgFare?.[0]?.avg ?? 0),
    };
  }

  async getDriverTripsWithCommission(
    driverId: Types.ObjectId,
    filter: "ALL" | "DUE" | "PAID",
    page: number,
    limit: number,
  ): Promise<{ data: any[]; total: number; totalCommission: number }> {
    const pipeline: any[] = [
      // Start from completed rides for this driver
      {
        $match: {
          driverId,
          rideStatus: RideStatus.COMPLETED,
        },
      },
      // Commission transactions for the ride (matched by tripId = ride._id)
      {
        $lookup: {
          from: "transactions",
          let: { tripId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$tripId", "$$tripId"] },
                    { $eq: ["$direction", TransactionDirection.CREDIT] },
                    { $eq: ["$type", TransactionType.COMMISSION] },
                  ],
                },
              },
            },
          ],
          as: "commissionTxns",
        },
      },
      // Determine commission status — completed transaction => PAID, else DUE
      {
        $addFields: {
          commissionStatus: {
            $cond: [
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: "$commissionTxns",
                        as: "ct",
                        cond: {
                          $eq: ["$$ct.status", TransactionStatus.COMPLETED],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
              DriverTripCommissionFilter.PAID,
              DriverTripCommissionFilter.DUE,
            ],
          },
          // Per-ride commission: use transaction amount if exists, else fare.totalAmount * 0.2
          commissionAmount: {
            $cond: [
              { $gt: [{ $size: "$commissionTxns" }, 0] },
              { $arrayElemAt: ["$commissionTxns.amount", 0] },
              {
                $multiply: [
                  { $ifNull: ["$fare.totalAmount", 0] },
                  0.2,
                ],
              },
            ],
          },
        },
      },
    ];

    // Apply commission status filter
    if (filter === "DUE") {
      pipeline.push({ $match: { commissionStatus: DriverTripCommissionFilter.DUE } });
    } else if (filter === "PAID") {
      pipeline.push({ $match: { commissionStatus: DriverTripCommissionFilter.PAID } });
    }

    pipeline.push({
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: page * limit },
          { $limit: limit },
          {
            $project: {
              tripId: "$_id",
              rideUUId: 1,
              pickupLocation: 1,
              dropoffLocation: 1,
              fare: 1,
              paymentDetails: 1,
              createdAt: 1,
              commission: { $round: ["$commissionAmount", 2] },
              commissionStatus: 1,
            },
          },
        ],
        total: [{ $count: "count" }],
        // Total commission across ALL completed rides (no pagination)
        totalCommission: [
          { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
        ],
      },
    });

    const [result] = await this._model.aggregate(pipeline);

    return {
      data: result?.data || [],
      total: result?.total?.[0]?.count || 0,
      totalCommission: Math.round((result?.totalCommission?.[0]?.total || 0) * 100) / 100,
    };
  }

  async getRiderReviews(
    riderId: Types.ObjectId,
    pageInput: { page?: number; limit?: number },
  ) {
    const page = pageInput.page ?? 0;
    const limit = pageInput.limit ?? 10;

    const [result] = await this.ratingModel.aggregate([
      { $match: { ratedTo: riderId } }, // ratings THIS rider received
      {
        $lookup: {
          from: "rides",
          localField: "rideId",
          foreignField: "_id",
          as: "ride",
        },
      },
      { $unwind: { path: "$ride", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "remarks",
          localField: "remark",
          foreignField: "_id",
          as: "remarkDoc",
        },
      },
      { $unwind: { path: "$remarkDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          rideId: "$ride._id",
          rideUUId: "$ride.rideUUId",
          pickup: "$ride.pickupLocation.address",
          drop: "$ride.dropoffLocation.address",
          fare: { $ifNull: ["$ride.fare.totalFare", 0] },
          raterName: "$ratedByUser.fullName",
          raterProfileImage: "$ratedByUser.profileImage",
          raterShortId: { $substrBytes: [{ $toString: "$ratedBy" }, 20, 4] },
          createdAt: {
            $dateToString: {
              date: "$createdAt",
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
            },
          },
          rating: 1,
          review: { $ifNull: ["$remarkByUser", "$ratingRemarks"] },
          feedbackTag: "$remarkDoc.name",
        },
      },
      {
        $facet: {
          paginatedResults: [
            { $sort: { createdAt: -1 } },
            { $skip: page * limit },
            { $limit: limit },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const total = result?.totalCount?.[0]?.count ?? 0;
    return {
      data: result?.paginatedResults ?? [],
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findRides(input: RidesListInput) {
    const { status, timeRange, search, page, limit } = input;

    const match: Record<string, any> = {
      deleted: { $ne: true },
      // ,
      // bookingTime: { $gte: new Date(Date.now() - TIME_RANGE_MS[timeRange]) },
    };
    if (status) match.rideStatus = status;

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: "users",
          localField: "passengerId",
          foreignField: "_id",
          as: "riderUser",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "driverId",
          foreignField: "_id",
          as: "driverUser",
        },
      },
      { $unwind: { path: "$riderUser", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$driverUser", preserveNullAndEmptyArrays: true } },
    ];

    if (search) {
      const regex = new RegExp(search, "i");
      pipeline.push({
        $match: {
          $or: [
            { rideUUId: regex },
            { "riderUser.fullName": regex },
            { "driverUser.fullName": regex },
          ],
        },
      });
    }

    pipeline.push({
      $facet: {
        data: [
          { $sort: { bookingTime: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        totalCount: [{ $count: "count" }],
      },
    });

    const [result] = await this._model.aggregate(pipeline);
    return {
      rides: result.data,
      total: result.totalCount[0]?.count ?? 0,
    };
  }

  /**
   * Updates ride with timing data when the ride starts.
   * Sets rideStartedAt and recalculates estimatedFare and estimatedTimeInMinutes
   * based on distance and booking time.
   */
  async startRide(
    rideId: Types.ObjectId,
    startedAt: Date,
    distanceInKm?: number,
  ): Promise<RidesDocument | null> {
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
  async completeRide(
    rideId: Types.ObjectId,
    completedAt: Date,
    distanceInKm?: number,
  ): Promise<RidesDocument | null> {
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
   * Fetches rides for a user with cursor-based pagination, grouped by date.
   * Supports filtering by ride status (ongoing, completed, canceled, all)
   * and sorting by bookingTime or createdAt.
   */
  async findRidesByUserWithCursorPagination(
    user: Partial<User>,
    paginationInput: GetAllRidesPaginationInput,
  ): Promise<{
    data: any[];
    pageInfo: { nextCursor: string | null; hasNextPage: boolean };
  }> {
    // Build filter based on user role
    const filter: any = {};

    // Apply ride status filter
    if (paginationInput.filter) {
      switch (paginationInput.filter) {
        case RideFilterStatus.PENDING:
          filter.rideStatus = { $in: [RideStatus.PENDING] };
          break;
        case RideFilterStatus.COMPLETED:
          filter.rideStatus = RideStatus.COMPLETED;
          break;
        case RideFilterStatus.CANCELLED:
          filter.rideStatus = RideStatus.CANCELLED;
          break;
        case RideFilterStatus.ALL:
        default:
          // Exclude PICKUP and CONFIRMED rides for ALL/default filter
          filter.rideStatus = {
            $nin: [RideStatus.PICKUP, RideStatus.CONFIRMED],
          };
          break;
      }
    }

    // Check user roles and apply appropriate filter
    if (user.loginAs === roles.USER) {
      filter.passengerId = new Types.ObjectId(user._id);
    } else if (user.loginAs === roles.RIDER) {
      filter.driverId = new Types.ObjectId(user._id);
    }

    const limit = paginationInput.limit ?? 5;
    const sortField = paginationInput.sortBy || RideSortBy.BOOKING_TIME;
    const sortDirection = paginationInput.order === 1 ? 1 : -1;
    const cursor = paginationInput.cursor;

    // Build cursor query if cursor is provided
    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      const cursorValue = decoded[sortField];
      const cursorId = decoded._id;

      if (sortDirection === -1) {
        filter.$or = [
          { [sortField]: { $lt: new Date(cursorValue) } },
          {
            [sortField]: new Date(cursorValue),
            _id: { $lt: new Types.ObjectId(cursorId) },
          },
        ];
      } else {
        filter.$or = [
          { [sortField]: { $gt: new Date(cursorValue) } },
          {
            [sortField]: new Date(cursorValue),
            _id: { $gt: new Types.ObjectId(cursorId) },
          },
        ];
      }
    }

    // Fetch limit + 1 to determine if there's a next page
    const docs = await this._model
      .find(filter)
      .populate([{ path: "vehicleId" }])
      .sort({ [sortField]: sortDirection, _id: sortDirection })
      .limit(limit + 1)
      .exec();
    let hasNextPage = false;
    let nextCursor: string | null = null;

    if (docs.length > limit) {
      hasNextPage = true;
      const nextItem = docs[limit];
      nextCursor = this.encodeCursor({
        [sortField]: (nextItem as any)[sortField],
        _id: nextItem._id,
      });
      docs.pop(); // Remove the extra item
    }

    // Map populated vehicleId to vehicle field for GraphQL
    const mappedDocs = docs.map((ride: any) => {
      if (ride.vehicleId && typeof ride.vehicleId === "object") {
        ride.vehicle = ride.vehicleId;
        ride.vehicleId = ride.vehicleId._id.toString();
      }
      return ride;
    });

    // Custom grouping: order by status priority then group by month+year
    // Priority: Ongoing/Pickup (1) > Scheduled upcoming (2) > Completed (3) > Cancelled (4)
    const statusPriority: Record<string, number> = {
      [RideStatus.ONGOING]: 1,
      [RideStatus.PICKUP]: 1,
      [RideStatus.CONFIRMED]: 2,
      [RideStatus.PENDING]: 2,
      [RideStatus.COMPLETED]: 3,
      [RideStatus.CANCELLED]: 4,
    };

    const getMonthYearLabel = (date: Date): string => {
      return date.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kathmandu",
      });
    };

    // Sort mappedDocs by status priority first, then by sortField descending
    const sortedDocs = [...mappedDocs].sort((a: any, b: any) => {
      const aPriority = statusPriority[a.rideStatus] || 99;
      const bPriority = statusPriority[b.rideStatus] || 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      // Within same status, sort by the configured sortField descending
      const aVal = new Date(a[sortField]).getTime();
      const bVal = new Date(b[sortField]).getTime();
      return bVal - aVal;
    });

    // Group by month+year using the sort field (bookingTime or createdAt) in Asia/Kathmandu timezone
    const groupMap = new Map<string, any[]>();
    for (const ride of sortedDocs) {
      const date = new Date(ride[sortField]);
      const label = getMonthYearLabel(date);
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label)!.push(ride);
    }

    const groupedData = Array.from(groupMap.entries()).map(
      ([title, rides]) => ({
        title,
        rides,
      }),
    );

    return {
      data: groupedData,
      pageInfo: {
        nextCursor,
        hasNextPage,
      },
    };
  }

  async homeDashboardApi(user: Partial<User>): Promise<RidesDocument[]> {
    // Build filter based on user role
    let filter: any = {
      deleted: false,
    };

    if (user.loginAs === roles.USER) {
      filter.passengerId = new Types.ObjectId(user._id);
    } else if (user.loginAs === roles.RIDER) {
      filter.driverId = new Types.ObjectId(user._id);
    }
    const populateOptions = [
      { path: "vehicleId" },
      { path: "driverId", select: "_id phone email" },
      { path: "passengerId", select: "_id phone email" },
    ];
    const upcomingResult = await this.model
      .find({
        rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.PENDING] },
        ...filter,
      })
      .populate(populateOptions)
      .limit(3);

    const ongoingResult = await this.model
      .find({
        rideStatus: { $in: [RideStatus.ONGOING, RideStatus.PICKUP] },
        ...filter,
      })
      .populate(populateOptions)
      .sort({ createdAt: -1 })
      .limit(1);

    return [...ongoingResult, ...upcomingResult];
  }

  async findByIdWithVehicle(
    rideId: string,
    passengerId: string,
  ): Promise<RidesDocument | null> {
    const rideWithVechile = await this._model
      .findOne({
        _id: new Types.ObjectId(rideId),
        passengerId: new Types.ObjectId(passengerId),
      })
      .populate("vehicleId")
      .exec();
    if (
      rideWithVechile?.vehicleId &&
      typeof rideWithVechile?.vehicleId === "object"
    ) {
      rideWithVechile.vehicle = rideWithVechile.vehicleId as any;
      delete rideWithVechile.vehicleId;
    }
    return rideWithVechile;
  }

  async cancelRide(params: CancelRideParams): Promise<RidesDocument> {
    return this._model.findByIdAndUpdate(
      new Types.ObjectId(params.rideId),
      {
        rideStatus: RideStatus.CANCELLED,
        cancellationDetail: {
          cancelledAt: new Date(),
          cancelledBy: params.cancelledBy,
          cancelledByRole: params.cancelledByRole,
          cancelSubCategoryId: params.cancelSubCategoryId,
          cancelSubCategoryLabel: params.cancelSubCategoryLabel,
          cancelReasonContent: params.cancelReasonContent ?? null,
        },
      },
      { new: true },
    );
  }

  async findByIdWithAllDetails(rideId: string): Promise<RidesDocument | null> {
    const filter = {
      _id: rideId,
    };

    const populate: Populate = [
      { path: "vehicleId" },
      { path: "driverId", select: "_id phone email" },
      { path: "passengerId", select: "_id  email phone" },
    ];

    return this.findOne(filter, populate);
  }

  async findUpcomingConfirmedRideById(
    rideId: string,
    user: Partial<User>,
  ): Promise<RidesDocument | null> {
    const filter: any = {
      _id: rideId,
      rideStatus: RideStatus.CONFIRMED,
      bookingTime: { $gt: new Date() },
      deleted: false,
    };

    if (user.loginAs === roles.USER) {
      filter.passengerId = new Types.ObjectId(user._id);
    } else if (user.loginAs === roles.RIDER) {
      filter.driverId = new Types.ObjectId(user._id);
    }

    const populate: Populate = [
      { path: "vehicleId" },
      { path: "passengerId", select: "_id phone email" },
      { path: "driverId", select: "_id phone email" },
    ];

    return this.findOne(filter, populate);
  }

  async updateUpcomingConfirmedRide(
    rideId: string,
    user: Partial<User>,
    updateData: {
      bookingTime?: Date;
      pickupLocation?: any;
      dropoffLocation?: any;
      noOfPassengers?: number;
    },
  ): Promise<RidesDocument | null> {
    const filter: any = {
      _id: rideId,
      rideStatus: RideStatus.CONFIRMED,
      bookingTime: { $gt: new Date() },
      deleted: false,
    };

    if (user.loginAs === roles.USER) {
      filter.passengerId = new Types.ObjectId(user._id);
    } else if (user.loginAs === roles.RIDER) {
      filter.driverId = new Types.ObjectId(user._id);
    }

    const setFields: any = {};
    if (updateData.bookingTime) setFields.bookingTime = updateData.bookingTime;
    if (updateData.pickupLocation)
      setFields.pickupLocation = updateData.pickupLocation;
    if (updateData.dropoffLocation)
      setFields.dropoffLocation = updateData.dropoffLocation;
    if (updateData.noOfPassengers)
      setFields.noOfPassengers = updateData.noOfPassengers;

    const populate: Populate = [
      { path: "vehicleId" },
      { path: "passengerId", select: "_id  email phone" },
      { path: "driverId", select: "_id email phone" },
    ];

    return this.findOneAndUpdate(
      filter,
      { $set: setFields },
      { new: true },
      populate,
    );
  }

  async getOngoingRideWithDetails(
    rideId: string,
    passengerId: Types.ObjectId,
  ): Promise<any> {
    const filter = {
      _id: rideId,
      passengerId: new Types.ObjectId(passengerId),
      rideStatus: RideStatus.ONGOING,
    };

    const populate: Populate = [
      {
        path: "vehicleId",
        select: "vehicleModel year color numberPlate vehicleType",
      },
      { path: "driverId", select: "_id email phone" },
      { path: "passengerId", select: "_id phone email" },
    ];

    const projection = {
      _id: 1,
      rideUUId: 1,
      rideStatus: 1,
      rideType: 1,
      bookingTime: 1,
      rideStartedAt: 1,
      rideCompletedAt: 1,
      estimatedTimeInMinutes: 1,
      estimatedFare: 1,
      distanceInKm: 1,
      distanceToReachPassenger: 1,
      estimatedTimeToReachPassenger: 1,
      pickupLocation: 1,
      dropoffLocation: 1,
      fare: 1,
      paymentDetails: 1,
      vehicleId: 1,
      driverId: 1,
      passengerId: 1,
      ablyChannelId: 1,
    };

    return this.findOne(filter, populate, projection);
  }

  async findActiveRidesByDriverId(driverId: string): Promise<RidesDocument[]> {
    return this._model.find({
      driverId: new Types.ObjectId(driverId),
      rideStatus: {
        $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP],
      },
      deleted: false,
    });
  }

  async findUpcomingRidesByDriverId(
    driverId: string,
  ): Promise<RidesDocument[]> {
    return this._model.find({
      driverId: new Types.ObjectId(driverId),
      rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.PENDING] },
      bookingTime: { $gt: new Date() },
      deleted: false,
    });
  }

  async findActiveRidesByPassengerId(
    passengerId: string,
  ): Promise<RidesDocument[]> {
    return this._model.find({
      passengerId: new Types.ObjectId(passengerId),
      rideStatus: {
        $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP],
      },
      deleted: false,
    });
  }

  async findUpcomingRidesByPassengerId(
    passengerId: string,
  ): Promise<RidesDocument[]> {
    return this._model.find({
      passengerId: new Types.ObjectId(passengerId),
      rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.PENDING] },
      bookingTime: { $gt: new Date() },
      deleted: false,
    });
  }

  /**
   * Encodes a cursor from a data object for pagination.
   */
  protected encodeCursor(data: any): string {
    return Buffer.from(JSON.stringify(data)).toString("base64");
  }

  /**
   * Decodes a cursor string back to a data object.
   */
  protected decodeCursor(cursor: string): any {
    return JSON.parse(Buffer.from(cursor, "base64").toString());
  }

  async getRideHistoryOfIndividualRiderOrUser(
    user: Partial<User>,
    paginationInput: GetAllRidesPaginationInput,
  ) {
    // Build filter based on user role
    const filter: any = {};
    if (user.loginAs === roles.USER) {
      filter.passengerId = new Types.ObjectId(user._id);
    } else if (user.loginAs === roles.RIDER) {
      filter.driverId = new Types.ObjectId(user._id);
    }
    // Apply ride status filter
    if (paginationInput.filter) {
      switch (paginationInput.filter) {
        case RideFilterStatus.PENDING:
          filter.rideStatus = { $in: [RideStatus.PENDING] };
          break;
        case RideFilterStatus.COMPLETED:
          filter.rideStatus = RideStatus.COMPLETED;
          break;
        case RideFilterStatus.CANCELLED:
          filter.rideStatus = RideStatus.CANCELLED;
          break;
        case RideFilterStatus.ALL:
        default:
          // Exclude PICKUP and CONFIRMED rides for ALL/default filter
          filter.rideStatus = {
            $nin: [RideStatus.PICKUP, RideStatus.CONFIRMED],
          };
          break;
      }
    }
  }

  async findRideByIdAdmin(id: string) {
    const [ride] = await this._model.aggregate([
      { $match: { _id: new Types.ObjectId(id), deleted: { $ne: true } } },
      {
        $lookup: {
          from: "userdetails",
          localField: "passengerId",
          foreignField: "userId",
          as: "passengerDetails",
        },
      },
      {
        $lookup: {
          from: "userdetails",
          localField: "driverId",
          foreignField: "userId",
          as: "driverDetails",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "passengerId",
          foreignField: "_id",
          as: "passengerUser",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "driverId",
          foreignField: "_id",
          as: "driverUser",
        },
      },
      {
        $lookup: {
          from: "vehicles",
          localField: "vehicleId",
          foreignField: "_id",
          as: "vehicle",
        },
      },
      {
        $unwind: {
          path: "$passengerDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $unwind: { path: "$driverDetails", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$passengerUser", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$driverUser", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$vehicle", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          passenger: {
            fullName: "$passengerUser.fullName",
            phone: "$passengerUser.phone",
            profileImages: "$passengerDetails.profileImages",

            rating: "$passengerDetails.rating",
          },
          driver: {
            fullName: "$driverUser.fullName",
            phone: "$driverUser.phone",
            profileImages: "$driverDetails.profileImages",
            rating: "$driverDetails.rating",
          },
        },
      },
    ]);
    return ride ?? null;
  }
}
