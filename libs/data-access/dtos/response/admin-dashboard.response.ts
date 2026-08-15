// dtos/response/admin-dashboard.response.ts
import { Field, Float, Int, ObjectType } from "@nestjs/graphql";

/**
 * Response object for the admin dashboard statistics query.
 *
 * All monetary values are returned as numbers (no currency prefix — the
 * admin-panel is expected to format for display). Percent-change is rounded
 * to two decimal places.
 */
@ObjectType()
export class AdminDashboardResponse {
  @Field(() => Int, {
    description: "Total number of active rides (CONFIRMED / ONGOING / PICKUP) for the given date.",
  })
  totalActiveRides: number;

  @Field(() => Int, {
    description:
      "Number of unique active riders (drivers) involved in active rides for the given date.",
  })
  activeRider: number;

  @Field(() => Int, {
    description:
      "Number of unique active passengers involved in active rides for the given date.",
  })
  activePassenger: number;

  @Field(() => Float, {
    description:
      "Total revenue from completed commission transactions for the given date.",
  })
  totalRevenue: number;

  @Field(() => Int, {
    description:
      "Total number of completed commission transactions for the given date.",
  })
  completeCommissionTransactions: number;

  @Field(() => Int, {
    description:
      "Total number of cancelled rides for the given date (based on bookingTime).",
  })
  totalCancelledRides: number;

  @Field(() => Int, {
    description:
      "Total number of cancelled rides for the previous day (the day before the given date).",
  })
  previousDateTotalCancelledRides: number;

  @Field(() => Float, {
    description:
      "Percent change in cancelled rides between the previous day and the given date. Positive = increase, negative = decrease.",
  })
  cancelledRidesPercentChange: number;
}
