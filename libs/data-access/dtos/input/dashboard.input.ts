// dtos/input/dashboard.input.ts
import { Field, InputType } from "@nestjs/graphql";
import { IsDateString, IsNotEmpty } from "class-validator";

/**
 * Input for the admin dashboard statistics query.
 * `fromDate` and `endDate` define an inclusive date range. All statistics
 * (active rides, revenue, cancelled rides, etc.) are computed for rides
 * whose `bookingTime` falls within [fromDate, endDate].
 *
 * @example
 * query {
 *   adminDashboard(input: { fromDate: "2024-08-14", endDate: "2024-08-16" }) {
 *     totalActiveRides
 *     activeRider
 *     activePassenger
 *     totalRevenue
 *     completeCommissionTransactions
 *     totalCancelledRides
 *   }
 * }
 */
@InputType()
export class AdminDashboardInput {
  @Field(() => Date, {
    description:
      "The start date (inclusive) of the date range for which to fetch dashboard statistics.",
  })
  @IsNotEmpty()
  @IsDateString()
  fromDate: Date;

  @Field(() => Date, {
    description:
      "The end date (inclusive) of the date range for which to fetch dashboard statistics.",
  })
  @IsNotEmpty()
  @IsDateString()
  endDate: Date;
}
