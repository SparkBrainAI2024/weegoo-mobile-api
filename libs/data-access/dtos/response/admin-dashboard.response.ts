// dtos/response/admin-dashboard.response.ts
import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { RideDetailResponse } from "./rides-list.response";
import { Rides } from "../../entities/rides.entity";

/**
 * Single data point in the dashboard chart.
 * `label` is either a day label (e.g. "Feb 1") or a month label (e.g. "Jan"),
 * and `value` is the number of completed rides for that period.
 */
@ObjectType()
export class ChartDataPoint {
  @Field(() => String, {
    description: "Label for the chart data point (e.g. 'Feb 1' or 'Jan').",
  })
  label: string;

  @Field(() => Int, {
    description: "Number of completed rides for the given period.",
  })
  value: number;
}

/**
 * Response object for the dashboard rides chart query.
 * Returns a time-series of completed ride counts, grouped either by day
 * (when the range spans 2 months or less) or by month (when the range
 * spans more than 2 months).
 */
@ObjectType()
export class DashboardChartResponse {
  @Field(() => [ChartDataPoint], {
    description:
      "Time-series data points of completed rides, grouped by day or month.",
  })
  data: ChartDataPoint[];

  @Field(() => String, {
    description: "The grouping mode used: 'day' or 'month'.",
  })
  groupBy: "day" | "month";

  @Field(() => Int, {
    description: "Total number of completed rides in the date range.",
  })
  total: number;
}

/**
 * Response object for the admin dashboard statistics query.
 *
 * All monetary values are returned as numbers (no currency prefix — the
 * admin-panel is expected to format for display). Percent-change is rounded
 * to two decimal places.
 */
/**
 * Response object for the completed rides query in the admin dashboard.
 * Combines the paginated rides list with the chart time-series data
 * (grouped by day or by month depending on the date range).
 */
/**
 * Status breakdown for a given date range.
 * Counts of rides grouped by their status: ONGOING / COMPLETED / CANCELLED.
 */
@ObjectType()
export class RideStatusBreakdown {
  @Field(() => Int, {
    description: "Number of ongoing rides (status ONGOING) in the date range.",
  })
  ongoing: number;

  @Field(() => Int, {
    description: "Number of completed rides (status COMPLETED) in the date range.",
  })
  completed: number;

  @Field(() => Int, {
    description: "Number of cancelled rides (status CANCELLED) in the date range.",
  })
  cancelled: number;
}

@ObjectType()
export class CompletedRidesResponse {
  @Field(() => [Rides], {
    description: "All completed rides for the given date range.",
  })
  rides: Rides[];

  @Field(() => Int, {
    description: "Total number of completed rides in the date range.",
  })
  total: number;

  @Field(() => [ChartDataPoint], {
    description:
      "Time-series chart data — labels are 'Feb 1', 'Feb 2' (day) or 'Jan', 'Feb' (month) depending on range length.",
  })
  chartData: ChartDataPoint[];

  @Field(() => String, {
    description: "Chart grouping mode: 'day' or 'month'.",
  })
  chartGroupBy: "day" | "month";

  @Field(() => RideStatusBreakdown, {
    description:
      "Breakdown of ride statuses (ONGOING / COMPLETED / CANCELLED) for the given date range.",
  })
  breakdown: RideStatusBreakdown;
}

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
