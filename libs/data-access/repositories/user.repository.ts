import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import { User, UserDocument } from "../entities/user.entity";
import { ErrorException } from "@libs/common";
import { IPaginatedResult } from "../interfaces/pagination.interface";
import { roles, UserStatus } from "../enums/user.enum";
import { PipelineStage } from "mongoose";

@Injectable()
export class UserRepository extends BaseRepository<UserDocument> {
  constructor(
    @InjectModel(User.name) private readonly _model: BaseModel<UserDocument>,
  ) {
    super(_model);
  }
  findByEmail(email: string) {
    return this.model.findOne({ email });
  }

  findByPhone(phone: string) {
    return this.model.findOne({ phone });
  }

  userCounts() {
    try {
      return this.model.countDocuments();
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  get searchKeys(): string[] {
    return ["fullName", "phone", "email"];
  }

  async getDriverList(
    pageInput: { page?: number; limit?: number },
    status?: string,
    search?: string,
  ): Promise<
    IPaginatedResult<any> & { totalPending: number; totalBlocked: number }
  > {
    const page = pageInput.page ?? 0;
    const limit = pageInput.limit ?? 10;

    const match: Record<string, any> = {
      roles: roles.RIDER,
      deleted: false,
    };

    const commonPipeline: PipelineStage[] = [
      { $match: match },

      {
        $lookup: {
          from: "userdetails",
          localField: "_id",
          foreignField: "userId",
          as: "details",
        },
      },
      { $unwind: { path: "$details", preserveNullAndEmptyArrays: true } },

      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "details.fullName": { $regex: search, $options: "i" } },
                  { phone: { $regex: search, $options: "i" } },
                ],
              },
            } as PipelineStage,
          ]
        : []),

      {
        $addFields: {
          computedStatus: {
            $cond: [
              { $eq: ["$suspended", true] },
              UserStatus.BLOCKED,
              {
                $cond: [
                  { $eq: ["$verified", true] },
                  UserStatus.ACTIVE,
                  UserStatus.PENDING,
                ],
              },
            ],
          },
        },
      },
    ];

    const statusFilterStage: PipelineStage.FacetPipelineStage[] = status
      ? [{ $match: { computedStatus: status } }]
      : [];

    const [result] = await this.model.aggregate([
      ...commonPipeline,
      {
        $facet: {
          paginatedResults: [
            ...statusFilterStage,
            {
              $project: {
                id: "$_id",
                fullName: "$details.fullName",
                phone: 1,
                status: "$computedStatus",
                profileImages: "$details.profileImages",
                totalRidesAsDriver: { $ifNull: ["$details.totalRides", 0] },
                totalEarnings: { $ifNull: ["$details.totalEarnings", 0] },
                rating: { $ifNull: ["$details.rating", 0] },
                createdAt: 1,
                suspended: 1,
              },
            },
            { $sort: { totalRidesAsDriver: -1 } },
            { $skip: page * limit },
            { $limit: limit },
          ] as PipelineStage.FacetPipelineStage[],

          totalCount: [
            ...statusFilterStage,
            { $count: "count" },
          ] as PipelineStage.FacetPipelineStage[],

          statusCounts: [
            { $group: { _id: "$computedStatus", count: { $sum: 1 } } },
          ] as PipelineStage.FacetPipelineStage[],
        },
      },
    ]);

    const total = result.totalCount[0]?.count ?? 0;
    const counts = Object.fromEntries(
      result.statusCounts.map((s: any) => [s._id, s.count]),
    );

    return {
      data: result.paginatedResults,
      pagination: {
        total,
        page,
        limit,
        hasNextPage: (page + 1) * limit < total,
        hasPreviousPage: page > 0,
        nextPage: (page + 1) * limit < total ? page + 1 : undefined,
        previousPage: page > 0 ? page - 1 : undefined,
      },
      totalPending: counts["PENDING"] ?? 0,
      totalBlocked: counts["BLOCKED"] ?? 0,
    } as any;
  }

  async getPassengersList(
    pageInput: { page?: number; limit?: number },
    status?: string,
    search?: string,
  ): Promise<IPaginatedResult<any>> {
    const match: Record<string, any> = {
      roles: { $in: [roles.USER] },
      deleted: false,
    };

    const basePipeline: PipelineStage[] = [
      { $match: match },

      // fullName, trips, spend, rating, profile image — all live on UserDetails
      {
        $lookup: {
          from: "userdetails",
          localField: "_id",
          foreignField: "userId",
          as: "details",
        },
      },
      { $unwind: { path: "$details", preserveNullAndEmptyArrays: true } },

      // search runs after the join, same reason as the driver pipeline
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "details.fullName": { $regex: search, $options: "i" } },
                  { phone: { $regex: search, $options: "i" } },
                ],
              },
            } as PipelineStage,
          ]
        : []),

      {
        $addFields: {
          computedStatus: {
            $cond: [
              { $eq: ["$suspended", true] },
              "BLOCKED",
              { $cond: [{ $eq: ["$verified", true] }, "ACTIVE", "PENDING"] },
            ],
          },
        },
      },

      {
        $project: {
          id: "$_id",
          fullName: "$details.fullName",
          phone: 1,
          status: "$computedStatus",
          profileImage: "$details.profileImage",
          totalTripsAsPassenger: {
            $ifNull: ["$details.totalTripsAsPassenger", 0],
          },
          totalSpendingOnRides: {
            $ifNull: ["$details.totalSpendingOnRides", 0],
          },
          rating: { $ifNull: ["$details.rating", 0] },
          createdAt: 1,
          suspended: 1,
        },
      },

      ...(status ? [{ $match: { status } } as PipelineStage] : []),
    ];

    const data = await this.aggregatePaginate(basePipeline, pageInput, {
      totalTripsAsPassenger: -1,
    });

    return data;
  }
}
