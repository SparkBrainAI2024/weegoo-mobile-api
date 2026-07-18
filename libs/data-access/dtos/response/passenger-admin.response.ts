import { PaginationInput } from "@libs/data-access/base/base.input";
import { Paginated } from "@libs/data-access/base/base.response";
import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class RiderOverviewResponse {
  @Field(() => ID) id: string;
  @Field() fullName: string;
  @Field({ nullable: true }) profileImage?: string;
  @Field() phone: string;
  @Field({ nullable: true }) email?: string;
  @Field() suspended: boolean;
  @Field({ nullable: true }) joinedDate?: string;
  @Field({ nullable: true }) lastActive?: string; // needs lastActiveAt on User entity
  @Field({ nullable: true }) phoneVerified?: boolean; // needs phoneVerified on User entity
}

@ObjectType()
export class TripListItem {
  @Field(() => ID) id: string;
  @Field() rideUUId: string;
  @Field() createdAt: string;
  @Field({ nullable: true }) pickupLocation?: string;
  @Field({ nullable: true }) dropoffLocation?: string;
  @Field() fare: number;
  @Field({ nullable: true }) paymentMethod?: string;
  @Field() status: string;
}

@ObjectType()
export class RiderTripsSummary {
  @Field() totalTrips: number;
  @Field() completed: number;
  @Field() cancelled: number;
  @Field() totalSpend: number;
  @Field() avgFare: number;
}

@ObjectType()
export class RiderTripsResponse extends Paginated(TripListItem) {
  @Field() averageRating: number;
  @Field() totalReviews: number;
  @Field(() => RiderTripsSummary) summary: RiderTripsSummary;
}

@ObjectType()
export class RatingBreakdown {
  @Field() fiveStar: number;
  @Field() fourStar: number;
  @Field() threeStar: number;
  @Field() twoStar: number;
  @Field() oneStar: number;
}

@ObjectType()
export class RatingListItem {
  @Field(() => ID) rideId: string;
  @Field() rideUUId: string;
  @Field({ nullable: true }) pickup?: string;
  @Field({ nullable: true }) drop?: string;
  @Field({ nullable: true }) fare?: number;
  @Field() raterName: string;
  @Field({ nullable: true }) raterProfileImage?: string;
  @Field({ nullable: true }) raterShortId?: string;
  @Field() createdAt: string;
  @Field() rating: number;
  @Field({ nullable: true }) review?: string;
  @Field({ nullable: true }) feedbackTag?: string;
}

@ObjectType()
export class RiderRatingsResponse extends Paginated(RatingListItem) {
  @Field() averageRating: number;
  @Field() totalReviews: number;
  @Field(() => RatingBreakdown) breakdown: RatingBreakdown;
}
