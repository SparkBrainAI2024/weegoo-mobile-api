// dtos/response/admin-dashboard.response.ts
import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { RideDetailResponse } from "./rides-list.response";

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
 * Response object for the passenger registration chart query in the admin dashboard.
 * Returns a time-series of the number of passenger users (role USER) who joined
 * (createdAt) between fromDate and toDate, grouped by day or by month depending
 * on the date range.
 */
@ObjectType()
export class PassengerRegistrationChartResponse {
  @Field(() => [ChartDataPoint], {
    description:
      "Time-series data points of passenger registrations, grouped by day or month.",
  })
  data: ChartDataPoint[];

  @Field(() => String, {
    description: "The grouping mode used: 'day' or 'month'.",
  })
  groupBy: "day" | "month";

  @Field(() => Int, {
    description: "Total number of passengers who joined in the date range.",
  })
  total: number;
}

/**
 * Response object for the completed rides query in the admin dashboard.
 * Returns chart time-series data of completed ride counts and the total
 * count, grouped by day or by month depending on the date range.
 */
@ObjectType()
export class CompletedRidesResponse {
  @Field(() => Int, {
    description: "Total number of completed rides in the date range.",
  })
  total: number;

  @Field(() => [ChartDataPoint], {
    description:
      "Time-series chart data — labels are 'Feb 1', 'Feb 2' (day) or 'Jan', 'Feb' (month) depending on range length.",
  })
  chartData: ChartDataPoint[];
}

@ObjectType()
export class DriverStatusCounts {
  @Field(() => Int, { description: "Total number of drivers in the system." })
  totalDrivers: number;
  @Field(() => Int, { description: "Number of drivers currently online." })
  onlineDrivers: number;
  @Field(() => Int, { description: "Number of drivers currently offline." })
  offlineDrivers: number;
}

@ObjectType()
export class UserStatsResponse {
  @Field(() => Int, { description: "Total number of users in the system." })
  totalUsers: number;
  @Field(() => Int, { description: "Number of users who joined today." })
  usersJoinedToday: number;
  @Field(() => Int, { description: "Total number of suspended users." })
  suspendedUsers: number;
}

/**
 * Response object for the ride status pie chart query in the admin dashboard.
 * Returns counts of rides grouped by status (ongoing, cancelled, completed)
 * for a given date range based on bookingTime.
 */
@ObjectType()
export class RideStatusChartResponse {
  @Field(() => Int, {
    description: "Number of ongoing rides (CONFIRMED, ONGOING, PICKUP, PENDING) in the date range.",
  })
  ongoing: number;

  @Field(() => Int, {
    description: "Number of cancelled rides in the date range.",
  })
  cancelled: number;

  @Field(() => Int, {
    description: "Number of completed rides in the date range.",
  })
  completed: number;
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

  @Field(() => DriverStatusCounts, {
   description:
    "Counts of drivers by online status (total, online, offline).",
  })
  driverStatus: DriverStatusCounts;

  @Field(() => UserStatsResponse, {
   description:
    "Counts of users by total, joined today, and suspended.",
  })
  userStatus: UserStatsResponse;
}
