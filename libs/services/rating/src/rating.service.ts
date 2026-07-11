import {
  PaginationInput,
  UserDetailsRepository,
} from "@libs/data-access";
import { Rating, RatingDocument } from "@libs/data-access/entities/rating.entity";
import { RatingRepository } from "@libs/data-access/repositories/rating.repository";
import { RemarkRepository } from "@libs/data-access/repositories/remark.repository";
import { CreateRatingInput } from "@libs/data-access/dtos/input/create-rating.input";
import { User } from "@libs/data-access/entities/user.entity";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorException } from "@libs/common/exceptions";
import { Types } from "mongoose";

@Injectable()
export class RatingService {
  constructor(
    private readonly ratingRepository: RatingRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly remarkRepository: RemarkRepository,
  ) {}

  /**
   * Creates a new rating after validation.
   * - Validates rating is between 1 and 5
   * - Checks the user hasn't already rated the same ride
   * - Updates the ratedTo user's average rating in UserDetails
   */
  async createRating(
    user: User,
    input: CreateRatingInput,
  ): Promise<RatingDocument> {
    // Validate rating range
    if (input.rating < 1 || input.rating > 5) {
      ErrorException(
        null,
        "RATING.INVALID_RATING_RANGE",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if user has already rated this ride
    const alreadyRated = await this.ratingRepository.existsByUserAndRide(
      new Types.ObjectId(user._id),
      new Types.ObjectId(input.rideId),
    );

    if (alreadyRated) {
      ErrorException(
        null,
        "RATING.ALREADY_RATED",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Create the rating
    const rating = await this.ratingRepository.createRating({
      rating: input.rating,
      ratedBy: new Types.ObjectId(user._id),
      ratedTo: new Types.ObjectId(input.ratedTo),
      rideId: new Types.ObjectId(input.rideId),
      ratingRemarks: input.ratingRemarks,
      remark: input.remarkId
        ? new Types.ObjectId(input.remarkId)
        : undefined,
    } as Partial<RatingDocument>);

    // Update the ratedTo user's average rating in UserDetails
    await this.updateUserAverageRating(input.ratedTo);

    return rating;
  }

  /**
   * Lists ratings created by the current user with pagination.
   */
  async listRatings(
    user: User,
    paginationInput: PaginationInput,
  ) {
    return this.ratingRepository.listRatings(
      paginationInput,
      { ratedBy: new Types.ObjectId(user._id) },
    );
  }

  /**
   * Gets ratings for a specific user (ratedTo) with pagination.
   */
  async getRatingsForUser(
    userId: string,
    paginationInput: PaginationInput,
  ) {
    return this.ratingRepository.getRatingByUser(
      new Types.ObjectId(userId),
      paginationInput,
    );
  }

  /**
   * Lists all available remarks with pagination.
   */
  async listRemarks(paginationInput: PaginationInput) {
    return this.remarkRepository.listRemarks(paginationInput);
  }

  /**
   * Recalculates the average rating for a user and updates their UserDetails.
   */
  private async updateUserAverageRating(userId: string): Promise<void> {
    const averageRating = await this.ratingRepository.getAverageRatingByUser(
      new Types.ObjectId(userId),
    );

    await this.userDetailsRepository.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { rating: averageRating } },
      { new: true },
    );
  }
}