import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser, Roles } from '@libs/common';
import { User, roles, BasicResponse, CompleteRideInput, Rides, DriverRideResponse } from '@libs/data-access';
import { DriverRideAcceptanceService } from './driver-ride-acceptance.service';
import { RoleGuard } from '@libs/guards/role.guard';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
export class DriverRideResolver {
  private readonly logger = new Logger(DriverRideResolver.name);

  constructor(
    private readonly driverRideAcceptanceService: DriverRideAcceptanceService,
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
