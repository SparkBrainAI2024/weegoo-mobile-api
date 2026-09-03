import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import {
  User,
  RidesDocument,
  GetAllRidesPaginationInput,
  UserType,
  CreatePromoCodeInput,
  PromoCodeDocument,
} from "@libs/data-access";
import { RidesListInput } from "@libs/data-access/dtos/input/rides-list.input";
import { AdminDashboardInput } from "@libs/data-access/dtos/input/dashboard.input";
import { CancelRideInput } from "@libs/data-access/dtos/input/cancel-ride.input";
import { UpdateRideInput } from "@libs/data-access/dtos/input/update-ride.input";
import { RideDetailInput } from "@libs/data-access/dtos/input/ride-detail.input";
import {
  DashboardChartResponse,
  UserStatsResponse,
  RideStatusChartResponse,
  PassengerRegistrationChartResponse,
  DriverStatusCounts,
  TotalRidersChartResponse,
} from "@libs/data-access/dtos/response/admin-dashboard.response";
import { RideDetailResponse } from "@libs/data-access/dtos/response/rides-list.response";
import { RideAdminDashboardService } from "./services/ride-admin-dashboard.service";
import { RideQueryService } from "./services/ride-query.service";
import { RideLifecycleService } from "./services/ride-lifecycle.service";
import { RidePromoService } from "./services/ride-promo-code.service";

/**
 * Facade over the ride domain sub-services.
 *
 * Keeps the original public API surface so existing resolvers and modules
 * continue to work unchanged, while delegating implementation to focused
 * single-responsibility services:
 *  - RideAdminDashboardService — admin dashboard & analytics
 *  - RideQueryService          — read-only ride queries & driver trips
 *  - RideLifecycleService      — ride state mutations (create/start/complete/cancel/update)
 *  - RidePromoService          — promo-code application
 */
@Injectable()
export class RidesService {
  constructor(
    private readonly adminDashboardService: RideAdminDashboardService,
    private readonly queryService: RideQueryService,
    private readonly lifecycleService: RideLifecycleService,
    private readonly promoService: RidePromoService,
  ) {}

  // ---- Query: user-facing rides ----

  async findRides(user: User, options: GetAllRidesPaginationInput) {
    return this.queryService.findRides(user, options);
  }

  async getDriverTripsWithCommission(
    driverId: string,
    filter: "ALL" | "DUE" | "PAID",
    page: number,
    limit: number,
  ) {
    return this.queryService.getDriverTripsWithCommission(
      driverId,
      filter,
      page,
      limit,
    );
  }

  async getRidesList(input: RidesListInput) {
    return this.adminDashboardService.getRidesList(input);
  }

  async enlistRidesByDriverOrPassenger(
    userId: string,
    historyAs: UserType,
    options: GetAllRidesPaginationInput,
  ) {
    return this.queryService.enlistRidesByDriverOrPassenger(
      userId,
      historyAs,
      options,
    );
  }

  async homeDashboardApi(user: User): Promise<any> {
    return this.queryService.homeDashboardApi(user);
  }

  async getRideById(rideId: string, user: User): Promise<any> {
    return this.queryService.getRideById(rideId, user);
  }

  async getRideByIdAdmin(id: string) {
    return this.queryService.getRideByIdAdmin(id);
  }

  async getRideDetail(input: RideDetailInput): Promise<RideDetailResponse> {
    return this.queryService.getRideDetail(input);
  }

  async getOngoingRideWithDetails(
    rideId: string,
    userId: Types.ObjectId,
  ): Promise<any> {
    return this.queryService.getOngoingRideWithDetails(rideId, userId);
  }

  // ---- Lifecycle mutations ----

  async createRide(rideData: Partial<RidesDocument>): Promise<RidesDocument> {
    return this.lifecycleService.createRide(rideData);
  }

  async startRide(
    rideId: Types.ObjectId,
    startedAt: Date,
    distanceInKm?: number,
  ): Promise<RidesDocument | null> {
    return this.lifecycleService.startRide(rideId, startedAt, distanceInKm);
  }

  async completeRide(
    rideId: Types.ObjectId,
    completedAt: Date,
    distanceInKm?: number,
  ): Promise<any> {
    return this.lifecycleService.completeRide(
      rideId,
      completedAt,
      distanceInKm,
    );
  }

  async cancelRide(user: User, input: CancelRideInput): Promise<RidesDocument> {
    return this.lifecycleService.cancelRide(user, input);
  }

  async updateRide(user: User, input: UpdateRideInput): Promise<any> {
    return this.lifecycleService.updateRide(user, input);
  }

  async generateSampleRides(
    driverId: Types.ObjectId,
    riderId: Types.ObjectId,
    vehicleId: Types.ObjectId,
    adminId: Types.ObjectId,
  ): Promise<RidesDocument[]> {
    return this.lifecycleService.generateSampleRides(
      driverId,
      riderId,
      vehicleId,
      adminId,
    );
  }

  // ---- Promo codes ----

  async createPromoCode(
    input: CreatePromoCodeInput,
  ): Promise<PromoCodeDocument> {
    return this.promoService.createPromoCode(input);
  }

  async applyPromoCode(
    user: User,
    rideId: string,
    promoCodeId: string,
  ): Promise<any> {
    return this.promoService.applyPromoCode(user, rideId, promoCodeId);
  }

  async removePromoCode(user: User, rideId: string): Promise<any> {
    return this.promoService.removePromoCode(user, rideId);
  }

  // ---- Admin dashboard & analytics ----

  async getAdminDashboard(input: AdminDashboardInput) {
    return this.adminDashboardService.getAdminDashboard(input);
  }

  async getRideStatusChart(
    input: AdminDashboardInput,
  ): Promise<RideStatusChartResponse> {
    return this.adminDashboardService.getRideStatusChart(input);
  }

  async getUserStats(
    fromDate?: Date,
    endDate?: Date,
  ): Promise<UserStatsResponse> {
    return this.adminDashboardService.getUserStats(fromDate, endDate);
  }

  async getCompletedRideDashboardChart(
    input: AdminDashboardInput,
  ): Promise<DashboardChartResponse> {
    return this.adminDashboardService.getCompletedRideDashboardChart(input);
  }

  async getPassengerRegistrationChart(
    input?: AdminDashboardInput,
  ): Promise<PassengerRegistrationChartResponse> {
    return this.adminDashboardService.getPassengerRegistrationChart(input);
  }

  async getDriverStatusCounts(): Promise<DriverStatusCounts> {
    return this.adminDashboardService.getDriverStatusCounts();
  }

  async getTotalRidersChart(): Promise<TotalRidersChartResponse> {
    return this.adminDashboardService.getTotalRidersChart();
  }
}
