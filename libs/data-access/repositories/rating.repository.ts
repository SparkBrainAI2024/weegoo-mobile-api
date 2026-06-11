import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import { Rating, RatingDocument } from "../entities/rating.entity";
import { PaginationInput } from "../base/base.input";
import { IPaginatedResult } from "../interfaces/pagination.interface";
import { Types } from "mongoose";

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

  async listRatings(
    paginationInput: PaginationInput,
    filter: any = {},
  ): Promise<IPaginatedResult<RatingDocument>> {
    return this.paginate(
      paginationInput,
      [
        { path: "ratedBy", select: "fullName phone" },
        { path: "ratedTo", select: "fullName phone" },
        { path: "rideId" },
      ],
      filter,
    );
  }

  async getRatingByUser(
    userId: Types.ObjectId,
    paginationInput: PaginationInput,
  ): Promise<IPaginatedResult<RatingDocument>> {
    return this.paginate(
      paginationInput,
      [
        { path: "ratedBy", select: "fullName phone" },
        { path: "ratedTo", select: "fullName phone" },
        { path: "rideId" },
      ],
      { ratedTo: userId },
    );
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
