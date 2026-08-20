import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  RidesRepository,
  RideStatus,
  roles,
  User,
  UserDocument,
  TransactionRepository,
  DriverOnlineStatus,
} from "@libs/data-access";
import { AdminDashboardInput } from "@libs/data-access/dtos/input/dashboard.input";
import { RidesListInput } from "@libs/data-access/dtos/input/rides-list.input";
import { CompletedRidesInput } from "@libs/data-access/dtos/input/completed-rides.input";
import {
  ChartDataPoint,
  CompletedRidesResponse,
  DashboardChartResponse,
  DriverStatusCounts,
  PassengerRegistrationChartResponse,
  UserStatsResponse,
  RideStatusChartResponse,
} from "@libs/data-access/dtos/response/admin-dashboard.response";

/**
 * Admin dashboard & analytics queries for the ride domain.
 *
 * Owns the aggregation pipelines that power the admin-panel charts:
 * active-ride stats, driver online/offline counts, user statistics,
 * completed-rides chart, and the passenger-registration chart.
 */
@Injectable()
export class RideAdminDashboardService {
  constructor(
    private readonly rideRepository: RidesRepository,
    private readonly transactionRepository: TransactionRepository,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async getRidesList(input: RidesListInput) {
    const { rides, total } = await this.rideRepository.findRides(input);
    return {
      rides,
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  /**
   * Fetches admin dashboard statistics for a date range.
   *
   * Computes:
   *  - totalActiveRides: rides with status CONFIRMED / ONGOING / PICKUP within the date range
   *  - activeRider: unique drivers involved in active rides within the date range
   *  - activePassenger: unique passengers involved in active rides within the date range
   *  - totalRevenue: sum of completed commission transactions within the date range
   *  - completeCommissionTransactions: count of completed commission transactions within the date range
   *  - totalCancelledRides: cancelled rides within the date range
   */
  async getAdminDashboard(input: AdminDashboardInput) {
    const { fromDate, endDate } = input;

    // Start of fromDate (inclusive) and end of endDate (inclusive, end of day)
    const startDate = new Date(fromDate);
    startDate.setHours(0, 0, 0, 0);

    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    const activeStatuses = [
      RideStatus.CONFIRMED,
      RideStatus.ONGOING,
      RideStatus.PICKUP,
    ];

    const [
      { totalActiveRides, activeRider, activePassenger, totalCancelledRides },
      { totalRevenue, completedTransactionsCount },
    ] = await Promise.all([
      this.rideRepository.getAdminDashboardStats(
        startDate,
        endDateTime,
        activeStatuses,
      ),
      this.transactionRepository.getCommissionTransactionsByDateRange(
        startDate,
        endDateTime,
      ),
    ]);

    return {
      totalActiveRides,
      activeRider,
      activePassenger,
      totalRevenue,
      completeCommissionTransactions: completedTransactionsCount,
      totalCancelledRides,
    };
  }

  /**
   * Fetches driver online/offline status counts.
   *
   * When `fromDate` and `endDate` are provided, counts are filtered by the
   * driver's `createdAt` date range (users with `loginAs: RIDER`).
   * When no dates are provided, counts ALL drivers in the system.
   */
  async getDriverStatusCounts(
    fromDate?: Date,
    endDate?: Date,
  ): Promise<DriverStatusCounts> {
    const match: Record<string, any> = {
      loginAs: roles.RIDER,
    };

    if (fromDate && endDate) {
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      match.createdAt = { $gte: startDate, $lte: endDateTime };
    }

    const [result] = await this.userModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "userdetails",
          localField: "_id",
          foreignField: "userId",
          as: "details",
        },
      },
      {
        $unwind: {
          path: "$details",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: null,
          totalDrivers: { $sum: 1 },
          onlineDrivers: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$details.driverOnlineStatus",
                    DriverOnlineStatus.ONLINE,
                  ],
                },
                1,
                0,
              ],
            },
          },
          offlineDrivers: {
            $sum: {
              $cond: [
                {
                  $ne: [
                    "$details.driverOnlineStatus",
                    DriverOnlineStatus.ONLINE,
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    return {
      totalDrivers: result?.totalDrivers ?? 0,
      onlineDrivers: result?.onlineDrivers ?? 0,
      offlineDrivers: result?.offlineDrivers ?? 0,
    };
  }

  /**
   * Fetches ride counts by status (ongoing, cancelled, completed) for the
   * admin dashboard pie chart, within the given date range.
   *
   * "ongoing" includes CONFIRMED, ONGOING, PICKUP, and PENDING rides.
   * "completed" includes COMPLETED rides.
   * "cancelled" includes CANCELLED rides.
   */
  async getRideStatusChart(
    input: AdminDashboardInput,
  ): Promise<RideStatusChartResponse> {
    const { fromDate, endDate } = input;

    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return this.rideRepository.getRideStatusCounts(start, end);
  }

  /**
   * Fetches user statistics: total users, users who joined today,
   * and total suspended users.
   */
  async getUserStats(
    fromDate?: Date,
    endDate?: Date,
  ): Promise<UserStatsResponse> {
    const match: Record<string, any> = {};

    if (fromDate && endDate) {
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      match.createdAt = { $gte: startDate, $lte: endDateTime };
    }

    // Compute start of today for "joined today" count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [result] = await this.userModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          usersJoinedToday: {
            $sum: { $cond: [{ $gte: ["$createdAt", startOfToday] }, 1, 0] },
          },
          suspendedUsers: {
            $sum: { $cond: [{ $eq: ["$suspended", true] }, 1, 0] },
          },
        },
      },
    ]);

    return {
      totalUsers: result?.totalUsers ?? 0,
      usersJoinedToday: result?.usersJoinedToday ?? 0,
      suspendedUsers: result?.suspendedUsers ?? 0,
    };
  }

  /**
   * Fetches all completed rides within a date range for the admin dashboard.
   */
  async getCompletedRides(
    input: CompletedRidesInput,
  ): Promise<CompletedRidesResponse> {
    const { fromDate, endDate } = input;

    const startDate = new Date(fromDate);
    startDate.setHours(0, 0, 0, 0);

    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    const chart = await this.buildChartData(startDate, endDateTime);

    return {
      total: chart.total,
      chartData: chart.data,
    };
  }

  /**
   * Fetches the completed-rides chart data for the admin dashboard.
   */
  async getDashboardChart(
    input: AdminDashboardInput,
  ): Promise<DashboardChartResponse> {
    const { fromDate, endDate } = input;

    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return this.buildChartData(start, end);
  }

  /**
   * Fetches the passenger-registration chart data for the admin dashboard.
   *
   * Passengers are users whose roles array contains USER. For each day/month
   * between fromDate and toDate, the number of passenger users whose createdAt
   * falls within that period is returned so the admin panel can plot the
   * passenger joined over time.
   */
  async getPassengerRegistrationChart(
    input: AdminDashboardInput,
  ): Promise<PassengerRegistrationChartResponse> {
    const { fromDate, endDate } = input;

    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();

    const monthSpan =
      endYear * 12 + endMonth - (startYear * 12 + startMonth) + 1;

    const groupBy: "day" | "month" = monthSpan > 2 ? "month" : "day";

    const dateProjection =
      groupBy === "day"
        ? {
            $dateToString: { date: "$createdAt", format: "%Y-%m-%d" },
          }
        : {
            $dateToString: { date: "$createdAt", format: "%Y-%m" },
          };

    const aggregated = await this.userModel.aggregate([
      {
        $match: {
          roles: { $in: [roles.USER] },
          deleted: false,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: dateProjection,
          value: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          key: "$_id",
          value: 1,
        },
      },
      { $sort: { key: 1 } },
    ]);

    const valueByKey = new Map<string, number>();
    for (const item of aggregated) {
      valueByKey.set(item.key, item.value);
    }

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const data: ChartDataPoint[] = [];

    if (groupBy === "day") {
      const current = new Date(start);
      const endTime = end.getTime();
      while (current.getTime() <= endTime) {
        const key = `${current.getFullYear()}-${String(
          current.getMonth() + 1,
        ).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
        data.push({
          label: `${monthNames[current.getMonth()]} ${current.getDate()}`,
          value: valueByKey.get(key) ?? 0,
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      let year = startYear;
      let month = startMonth;
      while (year * 12 + month <= endYear * 12 + endMonth) {
        const key = `${year}-${String(month + 1).padStart(2, "0")}`;
        data.push({
          label: monthNames[month],
          value: valueByKey.get(key) ?? 0,
        });
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
    }

    const total = data.reduce((sum, point) => sum + point.value, 0);

    return { data, groupBy, total };
  }

  /**
   * Builds the chart time-series data for completed rides between `start` and `end`.
   *
   * Grouping rules:
   *  - If the range spans 2 months or fewer → group by **day**
   *    (labels like "Feb 1", "Feb 2")
   *  - If the range spans more than 2 months → group by **month**
   *    (labels like "Jan", "Feb")
   *
   * Days / months with no completed rides are included with value 0 so the
   * chart always shows a continuous period with no gaps.
   */
  private async buildChartData(
    start: Date,
    end: Date,
  ): Promise<DashboardChartResponse> {
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();

    const monthSpan =
      endYear * 12 + endMonth - (startYear * 12 + startMonth) + 1;

    const groupBy: "day" | "month" = monthSpan > 2 ? "month" : "day";

    const aggregated = await this.rideRepository.getCompletedRidesChart(
      start,
      end,
      groupBy,
    );

    const valueByKey = new Map<string, number>();
    for (const item of aggregated) {
      valueByKey.set(item.key, item.value);
    }

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const data: ChartDataPoint[] = [];

    if (groupBy === "day") {
      const current = new Date(start);
      const endTime = end.getTime();
      while (current.getTime() <= endTime) {
        const key = `${current.getFullYear()}-${String(
          current.getMonth() + 1,
        ).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
        data.push({
          label: `${monthNames[current.getMonth()]} ${current.getDate()}`,
          value: valueByKey.get(key) ?? 0,
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      let year = startYear;
      let month = startMonth;
      while (year * 12 + month <= endYear * 12 + endMonth) {
        const key = `${year}-${String(month + 1).padStart(2, "0")}`;
        data.push({
          label: monthNames[month],
          value: valueByKey.get(key) ?? 0,
        });
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
    }

    const total = data.reduce((sum, point) => sum + point.value, 0);

    return { data, groupBy, total };
  }
}