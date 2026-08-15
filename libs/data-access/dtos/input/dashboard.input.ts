// dtos/input/dashboard.input.ts
import { Field, InputType } from "@nestjs/graphql";
import { IsDateString, IsNotEmpty } from "class-validator";

/**
 * Input for the admin dashboard statistics query.
 * The `date` represents a calendar date. All statistics are computed
 * for that single calendar day, compared against the previous day
 * for the cancelled-rides percent-change metric.
 *
 * @example
 * query {
 *   adminDashboard(input: { date: "2024-08-14" }) {
 *     totalActiveRides
 *     activeRider
 *     activePassenger
 *     totalRevenue
 *     completeCommissionTransactions
 *     totalCancelledRides
 *     previousDateTotalCancelledRides
 *     cancelledRidesPercentChange
 *   }
 * }
 */
@InputType()
export class AdminDashboardInput {
  @Field(() => Date, {
    description:
      "The date for which to fetch dashboard statistics (calendar date).",
  })
  @IsNotEmpty()
  @IsDateString()
  date: Date;
}
