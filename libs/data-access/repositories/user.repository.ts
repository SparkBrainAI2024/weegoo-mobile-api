import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import { User, UserDocument } from "../entities/user.entity";
import { ErrorException } from "@libs/common";
import { IPaginatedResult } from "../interfaces/pagination.interface";
import { roles } from "../enums/user.enum";
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
  ): Promise<IPaginatedResult<any>> {
    const match: Record<string, any> = {
      roles: roles.RIDER,
      deleted: false,
    };

    if (search) {
      match.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const basePipeline: PipelineStage[] = [
      { $match: match },

      // totalRides — scoped per driver, completed rides only
      {
        $lookup: {
          from: "rides",
          let: { driverId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$driverId", "$$driverId"] },
                rideStatus: "COMPLETED",
              },
            },
            { $count: "count" },
          ],
          as: "rideStats",
        },
      },

      // earnings + rating + profile images from UserDetails
      {
        $lookup: {
          from: "userdetails",
          localField: "_id",
          foreignField: "userId",
          as: "details",
        },
      },
      { $unwind: { path: "$details", preserveNullAndEmptyArrays: true } },

      // derived status — adjust if a real status field exists elsewhere
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
          fullName: 1,
          phone: 1,
          status: "$computedStatus",
          profileImages: "$details.profileImages",
          totalRides: {
            $ifNull: [{ $arrayElemAt: ["$rideStats.count", 0] }, 0],
          },
          totalEarnings: { $ifNull: ["$details.totalEarnings", 0] },
          rating: { $ifNull: ["$details.rating", 0] },
          createdAt: 1,
        },
      },

      ...(status ? [{ $match: { status } } as PipelineStage] : []),
    ];

    return this.aggregatePaginate(basePipeline, pageInput, { totalRides: -1 });
  }
}
