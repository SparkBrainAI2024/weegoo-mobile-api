import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { LocationUpdateResult, UpdateLocationInput, User } from '@libs/data-access';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { UserDetails, UserDetailsDocument } from '@libs/data-access/entities/user-details.entity';
import { RideStatus } from '@libs/data-access/enums/rides.enum';
import { AblyService } from '@libs/services/ably';
import axios from 'axios';
import { EnvService } from '@libs/common/config/env.service';
@Resolver()
@UseGuards(AuthGuard)
export class DriverRideLocationResolver {
  private readonly logger = new Logger(DriverRideLocationResolver.name);

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(UserDetails.name) private readonly userDetailsModel: Model<UserDetailsDocument>,
    private readonly ablyService: AblyService,
    private readonly envService: EnvService,
  ) {}

  /**
   * Update the current driver's location for the active ride.
   * This publishes to D-LOCATION-{rideUUId} channel and updates
   * distanceToReachPassenger/estimatedTimeToReachPassenger in ride schema
   * via the ride-matchmaking service.
   */
  @Mutation(() => LocationUpdateResult, {
    name: 'updateDriverLocation',
    description: 'Update driver current location for real-time tracking and distance calculation',
  })
  async updateDriverLocation(
    @CurrentUser() user: User,
    @Args('input') input: UpdateLocationInput,
  ): Promise<LocationUpdateResult> {
    this.logger.log(`GraphQL: updateDriverLocation called by driver ${user._id}`);

    // Call the ride-matchmaking service via HTTP to update driver location
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004/graphql');
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation UpdateDriverLocation($input: UpdateDriverLocationInput!) {
              updateDriverLocation(input: $input) {
                success
                message
                latitude
                longitude
                updatedAt
              }
            }
          `,
          variables: { input: { driverId: user._id.toString(), latitude: input.latitude, longitude: input.longitude } },
        },
        { timeout: 15000 },
      );

      const result = response.data?.data?.updateDriverLocation;
      if (result) {
        return result;
      }
    } catch (error: any) {
      this.logger.error(`Failed to call matchmaking service for driver location: ${error?.message || error}`);
    }

    // Fallback: update directly if matchmaking service is unavailable
    try {
      const driverObjectId = new Types.ObjectId(user._id);
      
      // Update driver location in user details
      await this.userDetailsModel.findOneAndUpdate(
        { userId: driverObjectId, deleted: false },
        { $set: { geoLocation: { type: 'Point', coordinates: [input.longitude, input.latitude] } } },
        { new: true },
      ).exec();

      // Find active ride
      const activeRide = await this.ridesModel.findOne({
        driverId: driverObjectId,
        rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING] },
        deleted: false,
      }).exec();

      if (activeRide) {
        // Publish driver location update directly to Ably channel
        const channelId = activeRide.driverLocationChannelId || `D-LOCATION-${activeRide.rideUUId}`;
        await this.ablyService.publish(channelId, 'driver-location-update', {
          driverId: user._id.toString(),
          latitude: input.latitude,
          longitude: input.longitude,
          updatedAt: new Date().toISOString(),
        });

        this.logger.log(`Published driver location for ride ${activeRide.rideUUId} via fallback`);
      }

      return {
        success: true,
        message: 'Location updated successfully',
        latitude: input.latitude,
        longitude: input.longitude,
        updatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Failed to update driver location: ${error?.message || error}`);
      return {
        success: false,
        message: 'Failed to update location',
        latitude: input.latitude,
        longitude: input.longitude,
        updatedAt: new Date().toISOString(),
      };
    }
  }
}