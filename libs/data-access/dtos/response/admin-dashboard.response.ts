// dtos/response/admin-dashboard.response.ts
import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { RideDetailResponse } from "./rides-list.response";

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
    description: "Total number of active rides (CONFIRMED / ONGOING / PICKUP) for the given date range.",
  })
  totalActiveRides: number;

  @Field(() => Int, {
    description:
      "Number of unique active riders (drivers) involved in active rides for the given date range.",
  })
  activeRider: number;

  @Field(() => Int, {
    description:
      "Number of unique active passengers involved in active rides for the given date range.",
  })
  activePassenger: number;

  @Field(() => Float, {
    description:
      "Total revenue from completed commission transactions for the given date range.",
  })
  totalRevenue: number;

  @Field(() => Int, {
    description:
      "Total number of completed commission transactions for the given date range.",
  })
  completeCommissionTransactions: number;

  @Field(() => Int, {
    description:
      "Total number of cancelled rides for the given date range (based on bookingTime).",
  })
  totalCancelledRides: number;

}
