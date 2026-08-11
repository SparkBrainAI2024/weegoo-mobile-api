import { PaginationInput, UserDetailsRepository } from "@libs/data-access";
import {
  Rating,
  RatingDocument,
} from "@libs/data-access/entities/rating.entity";
import { RatingRepository } from "@libs/data-access/repositories/rating.repository";
import { RemarkRepository } from "@libs/data-access/repositories/remark.repository";
import { CreateRatingInput } from "@libs/data-access/dtos/input/create-rating.input";
import { User } from "@libs/data-access/entities/user.entity";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorException } from "@libs/common/exceptions";
import { Types } from "mongoose";
import { RideUserSnapshot } from "@libs/data-access/common/ride-user-snapshot";
import { UserRepository } from "@libs/data-access/repositories/user.repository";

@Injectable()
export class RatingService {
  constructor(
    private readonly ratingRepository: RatingRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly remarkRepository: RemarkRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Builds a RideUserSnapshot from a User document.
   */
  private async buildUserSnapshot(
    userId: Types.ObjectId,
  ): Promise<RideUserSnapshot> {
    const user = await this.userRepository.findById(userId);
    const userDetails = await this.userDetailsRepository.findOne({ userId });

    const snapshot = new RideUserSnapshot();
    snapshot.fullName = user?.fullName || "";
    snapshot.phone = user?.phone || "";
    snapshot.rating = userDetails?.rating || 0;
    const activeImage = userDetails?.profileImages?.find(
      (img) => img.status === "ACTIVE",
    );
    snapshot.profileImage =
      activeImage?.socialPicture || activeImage?.s3Key || undefined;
    snapshot.locationChannelId = userDetails?.locationChannelId || undefined;
    snapshot.geoLocation = userDetails?.geoLocation || undefined;

    return snapshot;
  }

  /**
   * Creates a new rating after validation.
   * - Validates rating is between 1 and 5
   * - Checks the user hasn't already rated the same ride
   * - Builds and stores user snapshots for ratedBy and ratedTo
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
      ErrorException(null, "RATING.ALREADY_RATED", HttpStatus.BAD_REQUEST);
    }

    // Build user snapshots
    const ratedByUserSnapshot = await this.buildUserSnapshot(
      new Types.ObjectId(user._id),
    );
    const ratedToUserSnapshot = await this.buildUserSnapshot(
      new Types.ObjectId(input.ratedTo),
    );

    // Create the rating
    const rating = await this.ratingRepository.createRating({
      rating: input.rating,
      ratedBy: new Types.ObjectId(user._id),
      ratedTo: new Types.ObjectId(input.ratedTo),
      rideId: new Types.ObjectId(input.rideId),
      ratingRemarks: input.ratingRemarks,
      ratedByUser: ratedByUserSnapshot,
      ratedToUser: ratedToUserSnapshot,
      remarkByUser: input.remarkByUser,
    } as Partial<RatingDocument>);

    // Update the ratedTo user's average rating in UserDetails
    await this.updateUserAverageRating(input.ratedTo);

    return rating;
  }

  /**
   * Lists ratings created by the current user with pagination.
   */
  async listRatings(user: User, paginationInput: PaginationInput) {
    return this.ratingRepository.listRatings(paginationInput, {
      ratedBy: new Types.ObjectId(user._id),
    });
  }

  /**
   * Gets a single rating by its ID.
   */
  async getRatingDetail(ratingId: string): Promise<RatingDocument | null> {
    return this.ratingRepository.getRatingDetail(new Types.ObjectId(ratingId));
  }

  /**
   * Gets ratings for a specific user (ratedTo) with pagination.
   */
  async getRatingsForUser(userId: string, paginationInput: PaginationInput) {
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
