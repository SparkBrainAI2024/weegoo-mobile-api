import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser, Roles } from '@libs/common';
import { User, roles, BasicResponse, DriverRideResponse } from '@libs/data-access';
import { DriverRideAcceptanceService } from './driver-ride-acceptance.service';
import { RoleGuard } from '@libs/guards/role.guard';
import { EnvService } from '@libs/common/config/env.service';
import axios from 'axios';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
export class DriverRideResolver {
  private readonly logger = new Logger(DriverRideResolver.name);

  constructor(
    private readonly driverRideAcceptanceService: DriverRideAcceptanceService,
    private readonly envService: EnvService,
  ) { }
  @Roles(roles.RIDER)
  @Mutation(() => DriverRideResponse, {
    name: 'acceptRide',
    description: 'Driver accepts a ride request (RIDER role only). Returns full ride details with driver/vehicle/passenger info.',
  })
  async acceptRide(
    @CurrentUser() user: User,
    @Args('rideId') rideId: string,
  ): Promise<DriverRideResponse> {
    const result = await this.driverRideAcceptanceService.acceptRide(rideId, user._id.toString());
    return {
      success: result.success,
      message: result.message,
      data: result.data ? {
        rideId: result.data.rideId,
        rideUUId: result.data.rideUUId,
        pickupLocation: { address: result.data.pickupLocation?.address, coordinates: result.data.pickupLocation?.coordinates, city: result.data.pickupLocation?.city },
        dropoffLocation: result.data.dropoffLocation ? { address: result.data.dropoffLocation.address, coordinates: result.data.dropoffLocation.coordinates, city: result.data.dropoffLocation.city } : null,
        distanceInKm: result.data.distanceInKm,
        estimatedFare: result.data.estimatedFare,
        estimatedTimeInMinutes: result.data.estimatedTimeInMinutes,
        driver: { driverId: result.data.driver.driverId, fullName: result.data.driver.fullName, phone: result.data.driver.phone, profileImage: result.data.driver.profileImage, rating: result.data.driver.rating },
        passenger: { passengerId: result.data.passenger.passengerId, fullName: result.data.passenger.fullName, phone: result.data.passenger.phone },
        vehicle: { vehicleId: result.data.vehicle.vehicleId, vehicleModel: result.data.vehicle.vehicleModel, vehicleType: result.data.vehicle.vehicleType, color: result.data.vehicle.color, numberPlate: result.data.vehicle.numberPlate, year: result.data.vehicle.year },
        acceptedAt: result.data.acceptedAt,
      } : null,
    };
  }

  @Roles(roles.RIDER)
  @Mutation(() => BasicResponse, {
    name: 'startRide',
    description: 'Driver starts ride - sets status to PICKUP, records rideStartedAt',
  })
  async startRide(
    @CurrentUser() user: User,
    @Args('rideId') rideId: string,
  ): Promise<BasicResponse> {
    this.logger.log(`GraphQL: Driver ${user._id} starting ride ${rideId}`);
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation StartRide($rideId: String!, $driverId: String!) {
              startRide(rideId: $rideId, driverId: $driverId) {
                success
                message
              }
            }
          `,
          variables: { rideId, driverId: user._id.toString() },
        },
      );
      const result = response.data?.data?.startRide;
      return {
        success: result?.success || false,
        message: result?.message || 'Failed to start ride',
      };
    } catch (err: any) {
      this.logger.error(`Failed to start ride via matchmaking service: ${err?.message || err}`);
      return { success: false, message: 'Failed to start ride' };
    }
  }

  @Roles(roles.RIDER)
  @Mutation(() => BasicResponse, {
    name: 'pickupPassenger',
    description: 'Driver picked up passenger - sets status to ONGOING, updates destination distance',
  })
  async pickupPassenger(
    @CurrentUser() user: User,
    @Args('rideId') rideId: string,
  ): Promise<BasicResponse> {
    this.logger.log(`GraphQL: Driver ${user._id} picked up passenger for ride ${rideId}`);
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation PickupPassenger($rideId: String!, $driverId: String!) {
              pickupPassenger(rideId: $rideId, driverId: $driverId) {
                success
                message
              }
            }
          `,
          variables: { rideId, driverId: user._id.toString() },
        },
      );
      const result = response.data?.data?.pickupPassenger;
      return {
        success: result?.success || false,
        message: result?.message || 'Failed to pickup passenger',
      };
    } catch (err: any) {
      this.logger.error(`Failed to pickup passenger via matchmaking service: ${err?.message || err}`);
      return { success: false, message: 'Failed to pickup passenger' };
    }
  }

  @Roles(roles.RIDER)
  @Mutation(() => DriverRideResponse, {
    name: 'rejectRide',
    description: 'Driver rejects a ride request (RIDER role only)',
  })
  async rejectRide(
    @CurrentUser() user: User,
    @Args('rideId') rideId: string,
  ): Promise<DriverRideResponse> {
    this.logger.log(`GraphQL: Driver ${user._id} rejecting ride ${rideId}`);
    const result = await this.driverRideAcceptanceService.rejectRide(rideId, user._id.toString());
   return {
      success: result.success,
      message: result.message,
      data: result.data ? {
        rideId: result.data.rideId,
        rideUUId: result.data.rideUUId,
        pickupLocation: { address: result.data.pickupLocation?.address, coordinates: result.data.pickupLocation?.coordinates, city: result.data.pickupLocation?.city },
        dropoffLocation: result.data.dropoffLocation ? { address: result.data.dropoffLocation.address, coordinates: result.data.dropoffLocation.coordinates, city: result.data.dropoffLocation.city } : null,
        distanceInKm: result.data.distanceInKm,
        estimatedFare: result.data.estimatedFare,
        estimatedTimeInMinutes: result.data.estimatedTimeInMinutes,
        driver: { driverId: result.data.driver.driverId, fullName: result.data.driver.fullName, phone: result.data.driver.phone, profileImage: result.data.driver.profileImage, rating: result.data.driver.rating },
        passenger: { passengerId: result.data.passenger.passengerId, fullName: result.data.passenger.fullName, phone: result.data.passenger.phone },
        vehicle: { vehicleId: result.data.vehicle.vehicleId, vehicleModel: result.data.vehicle.vehicleModel, vehicleType: result.data.vehicle.vehicleType, color: result.data.vehicle.color, numberPlate: result.data.vehicle.numberPlate, year: result.data.vehicle.year },
        acceptedAt: result.data.acceptedAt,
      } : null,
    };
  }
}
