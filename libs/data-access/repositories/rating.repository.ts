import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import { Rating, RatingDocument } from "../entities/rating.entity";
import { PaginationInput } from "../base/base.input";
import { IPaginatedResult } from "../interfaces/pagination.interface";
import { Types } from "mongoose";
import { RideUserSnapshot } from "../common/ride-user-snapshot";

@Injectable()
export class RatingRepository extends BaseRepository<RatingDocument> {
  constructor(
    @InjectModel(Rating.name)
    private readonly _model: BaseModel<RatingDocument>,
  ) {
    super(_model);
  }

  async createRating(data: Partial<RatingDocument>): Promise<RatingDocument> {
    return this._model.create(data);
  }

  /**
   * Builds ratedByUser and ratedToUser snapshots dynamically using $lookup from User and UserDetails collections.
   * Uses $mergeObjects to preserve existing snapshot data if already present, otherwise builds from User/UserDetails.
   */
  private async attachUserSnapshots(ratings: RatingDocument[]): Promise<RatingDocument[]> {
    if (!ratings || ratings.length === 0) return ratings;

    const ratingIds = ratings.map(r => r._id);

    const pipeline = [
      { $match: { _id: { $in: ratingIds } } },
      {
        $lookup: {
          from: "users",
          let: { ratedById: "$ratedBy", ratedToId: "$ratedTo" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$_id", ["$$ratedById", "$$ratedToId"]] }
              }
            },
            {
              $lookup: {
                from: "userdetails",
                localField: "_id",
                foreignField: "userId",
                as: "userDetails"
              }
            },
            {
              $addFields: {
                userDetails: { $arrayElemAt: ["$userDetails", 0] }
              }
            }
          ],
          as: "users"
        }
      },
      {
        $addFields: {
          ratedByUser: {
            $mergeObjects: [
              { $ifNull: ["$ratedByUser", {}] },
              {
                $let: {
                  vars: {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$users",
                            cond: { $eq: ["$$this._id", "$ratedBy"] }
                          }
                        },
                        0
                      ]
                    }
                  },
                  in: {
                    fullName: { $ifNull: ["$$user.fullName", ""] },
                    phone: { $ifNull: ["$$user.phone", ""] },
                    rating: { $ifNull: ["$$user.userDetails.rating", 0] },
                    profileImage: {
                      $let: {
                        vars: {
                          activeImage: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: { $ifNull: ["$$user.userDetails.profileImages", []] },
                                  cond: { $eq: ["$$this.status", "ACTIVE"] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          $cond: {
                            if: { $ne: ["$$activeImage", null] },
                            then: { $ifNull: ["$$activeImage.socialPicture", "$$activeImage.s3Key"] },
                            else: null
                          }
                        }
                      }
                    },
                    locationChannelId: { $ifNull: ["$$user.userDetails.locationChannelId", null] },
                    geoLocation: { $ifNull: ["$$user.userDetails.geoLocation", null] }
                  }
                }
              }
            ]
          },
          ratedToUser: {
            $mergeObjects: [
              { $ifNull: ["$ratedToUser", {}] },
              {
                $let: {
                  vars: {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$users",
                            cond: { $eq: ["$$this._id", "$ratedTo"] }
                          }
                        },
                        0
                      ]
                    }
                  },
                  in: {
                    fullName: { $ifNull: ["$$user.fullName", ""] },
                    phone: { $ifNull: ["$$user.phone", ""] },
                    rating: { $ifNull: ["$$user.userDetails.rating", 0] },
                    profileImage: {
                      $let: {
                        vars: {
                          activeImage: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: { $ifNull: ["$$user.userDetails.profileImages", []] },
                                  cond: { $eq: ["$$this.status", "ACTIVE"] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          $cond: {
                            if: { $ne: ["$$activeImage", null] },
                            then: { $ifNull: ["$$activeImage.socialPicture", "$$activeImage.s3Key"] },
                            else: null
                          }
                        }
                      }
                    },
                    locationChannelId: { $ifNull: ["$$user.userDetails.locationChannelId", null] },
                    geoLocation: { $ifNull: ["$$user.userDetails.geoLocation", null] }
                  }
                }
              }
            ]
          }
        }
      },
      {
        $project: {
          users: 0
        }
      }
    ];

    const aggregated = await this._model.aggregate(pipeline);

    // Map back to original order
    const ratingMap = new Map(aggregated.map(r => [r._id.toString(), r]));
    return ratings.map(r => {
      const enriched = ratingMap.get(r._id.toString());
      if (enriched) {
        (r as any).ratedByUser = enriched.ratedByUser;
        (r as any).ratedToUser = enriched.ratedToUser;
      }
      return r;
    });
  }

  async listRatings(
    paginationInput: PaginationInput,
    filter: any = {},
  ): Promise<IPaginatedResult<RatingDocument>> {
    const result = await this.paginate(
      paginationInput,
      [
        { path: "remark" },
      ],
      filter,
    );

    // Attach user snapshots dynamically
    result.data = await this.attachUserSnapshots(result.data);

    return result;
  }

  async getRatingByUser(
    userId: Types.ObjectId,
    paginationInput: PaginationInput,
  ): Promise<IPaginatedResult<RatingDocument>> {
    const result = await this.paginate(
      paginationInput,
      [
        { path: "remark" },
      ],
      { ratedTo: userId },
    );

    // Attach user snapshots dynamically
    result.data = await this.attachUserSnapshots(result.data);

    return result;
  }

  async getRatingDetail(ratingId: Types.ObjectId): Promise<RatingDocument | null> {
    const rating = await this.findById(ratingId, [
      { path: "remark" },
    ]);

    if (rating) {
      const enriched = await this.attachUserSnapshots([rating]);
      return enriched[0] || null;
    }

    return rating;
  }

  async getAverageRatingByUser(userId: Types.ObjectId): Promise<number> {
    const result = await this._model.aggregate([
      { $match: { ratedTo: userId } },
      {
        $group: {
          _id: null,
          totalRating: { $sum: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          averageRating: {
            $cond: {
              if: { $gt: ["$totalReviews", 0] },
              then: { $divide: ["$totalRating", "$totalReviews"] },
              else: 0,
            },
          },
        },
      },
    ]);

    return result.length ? Math.round(result[0].averageRating * 10) / 10 : 0;
  }
  async existsByUserAndRide(
    ratedBy: Types.ObjectId,
    rideId: Types.ObjectId,
  ): Promise<boolean> {
    const rating = await this._model.findOne({
      ratedBy: new Types.ObjectId(ratedBy),
      rideId: new Types.ObjectId(rideId),
    });
    return !!rating;
  }
}