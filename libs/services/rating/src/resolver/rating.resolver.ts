import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@libs/guards";
import { User } from "@libs/data-access/entities/user.entity";
import { Rating } from "@libs/data-access/entities/rating.entity";
import { PaginationInput } from "@libs/data-access/base/base.input";
import { RatingService } from "../rating.service";
import { CurrentUser } from "@libs/common";
import { CreateRatingInput } from "@libs/data-access/dtos/input/create-rating.input";
import { RatingListWithPaginationResponse } from "@libs/data-access/dtos/response/rating-list-with-pagination.response";

@Resolver(() => Rating)
@UseGuards(AuthGuard)
export class RatingResolver {
  constructor(private readonly ratingService: RatingService) {}

  @Mutation(() => Rating, { name: "createRating", description: "Create a rating for a ride" })
  async createRating(
    @CurrentUser() user: User,
    @Args("input") input: CreateRatingInput,
  ): Promise<Rating> {
    return this.ratingService.createRating(user, input) as Promise<Rating>;
  }

  @Query(() => RatingListWithPaginationResponse, { name: "listRatings", description: "List all ratings" })
  async listRatings(
    @Args("input") input: PaginationInput,
  ) {
    return this.ratingService.listRatings(input);
  }

  @Query(() => RatingListWithPaginationResponse, { name: "getRatingsForUser", description: "Get ratings for a specific user" })
  async getRatingsForUser(
    @Args("userId") userId: string,
    @Args("input") input: PaginationInput,
  ) {
    return this.ratingService.getRatingsForUser(userId, input);
  }
}