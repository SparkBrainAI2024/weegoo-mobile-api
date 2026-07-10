import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument, User } from '@libs/data-access/entities/user.entity';
import { UserDetails, UserDetailsDocument } from '@libs/data-access/entities/user-details.entity';
import { Vehicle, VehicleDocument } from '@libs/data-access/entities/vehicle.entity';
import { UserTokenMeta, UserTokenMetaDocument } from '@libs/data-access/entities/user-token-meta.entity';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { RideStatus } from '@libs/data-access/enums/rides.enum';
import { roles, DriverOnlineStatus } from '@libs/data-access/enums/user.enum';
import { getActiveProfileImageUrl } from '@libs/common/utils/entity.utils';
import { S3Service } from '@libs/s3/s3.service';
import { NearbyDriverResponse, NearbyDriversSubscriptionResponse } from '@libs/data-access/dtos/response/nearby-driver.response';

@Injectable()
export class NearbyDriversService {
  private readonly logger = new Logger(NearbyDriversService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserDetails.name) private readonly userDetailsModel: Model<UserDetailsDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(UserTokenMeta.name) private readonly userTokenMetaModel: Model<UserTokenMetaDocument>,
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    private readonly s3: S3Service,
  ) {}

  /**
   * Search for nearby available drivers within 1-10 km radius from the given coordinates
   * using MongoDB $geoNear aggregation for efficient spatial queries.
   *
 * Filters out drivers that:
 *   - Are not ONLINE (offline status)
 *   - Have active rides (CONFIRMED, ONGOING, PICKUP)
 *   - Are not verified or are suspended
 *
 * Returns: driver name, profile image, location, rating, vehicle info, distance
   */
  async getNearbyDrivers(
    passengerId: string,
    latitude: number,
    longitude: number,
    searchRadiusKm: number = 10,
  ): Promise<NearbyDriversSubscriptionResponse> {
    // Clamp search radius between 1 and 10 km
    const radiusKm = Math.min(Math.max(searchRadiusKm, 1), 10);

    // Step 1: Use $geoNear to find online drivers within radius
    // GeoJSON format requires [longitude, latitude] order
    const geoNearResults = await this.userDetailsModel.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [latitude, longitude],
          },
          distanceField: 'distanceInMeters',
          maxDistance: radiusKm * 1000, // Convert km to meters
          spherical: true,
          query: {
            driverOnlineStatus: DriverOnlineStatus.ONLINE,
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      // Filter: user must be verified, non-suspended, and have RIDER role
      {
        $match: {
          'user.loginAs': roles.RIDER,
          'user.suspended': { $ne: true },
          'user.verified': true,
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          fullName: 1,
          profileImages: 1,
          rating: 1,
          geoLocation: 1,
          distanceInMeters: 1,
          'user._id': 1,
          'user.fullName': 1,
        },
      },
    ]);
    console.log(`Found ${geoNearResults.length} nearby drivers for passenger ${passengerId} at (${latitude}, ${longitude}) within ${radiusKm} km`);
    if (geoNearResults.length === 0) {
      return { passengerId, latitude, longitude, drivers: [] };
    }

    // Build a map of results by userId for O(1) lookups
    const resultsMap = new Map<string, any>();
    for (const r of geoNearResults) {
      resultsMap.set(r.userId.toString(), r);
    }

    // Extract driver IDs from geoNear results
    const nearbyDriverIds = [...resultsMap.keys()];
    const nearbyObjectIds = nearbyDriverIds.map((id) => new Types.ObjectId(id));

    // Batch-check Firebase tokens and active rides in parallel.
    // NOTE: A missing/empty Firebase token must NOT exclude a driver from the
    // nearby list. The token is only needed for sending push notifications, not
    // for the driver being physically available/online. Excluding on token here
    // incorrectly drops valid, online, in-radius drivers from the result.
    const [tokenDocs, activeRides] = await Promise.all([
      this.userTokenMetaModel.find({
        userId: { $in: nearbyObjectIds },
      }).exec(),
      this.ridesModel.find({
        driverId: { $in: nearbyObjectIds },
        rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] },
      }).exec(),
    ]);

    const driverTokens = new Map<string, string | null>();
    for (const t of tokenDocs) {
      driverTokens.set(t.userId.toString(), t.firebaseToken ?? null);
    }
    const driversWithActiveRides = new Set(activeRides.map((r) => r.driverId.toString()));

    // Filter to eligible drivers: online, verified, in-radius, and NOT currently
    // on an active ride. Presence of a Firebase token is NOT a requirement.
    const eligibleDriverIds = nearbyDriverIds.filter(
      (did) => !driversWithActiveRides.has(did),
    );

    if (eligibleDriverIds.length === 0) {
      return { passengerId, latitude, longitude, drivers: [] };
    }

    // Fetch vehicles for eligible drivers
    const eligibleObjectIds = eligibleDriverIds.map((id) => new Types.ObjectId(id));
    const vehicles = await this.vehicleModel.find({ driverId: { $in: eligibleObjectIds } }).exec();
    const vehicleMap = new Map<string, VehicleDocument>();
    for (const v of vehicles) {
      vehicleMap.set(v.driverId.toString(), v);
    }

    // Build response from geoNear results (already sorted by distance ascending)
    const drivers: NearbyDriverResponse[] = [];
    for (const driverId of eligibleDriverIds) {
      const result = resultsMap.get(driverId);
      if (!result) continue;

      const driverCoords = result.geoLocation?.coordinates;
      if (!driverCoords || driverCoords.length < 2) continue;

      const driverLat = driverCoords[0];
      const driverLng = driverCoords[1];
      const distanceInKm = result.distanceInMeters / 1000;
      const vehicle = vehicleMap.get(driverId);

      drivers.push({
        driverId,
        driverName: result.fullName || result.user?.fullName || 'Driver',
        profileImage: getActiveProfileImageUrl(result.profileImages, (key) => this.s3.getPublicUrl(key)),
        latitude: driverLat,
        longitude: driverLng,
        rating: result.rating ?? 0,
        distanceInKm: Math.round(distanceInKm * 100) / 100,
        vehicleType: vehicle?.vehicleType || undefined,
        vehicleModel: vehicle?.vehicleModel || undefined,
        color: vehicle?.color || undefined,
        numberPlate: vehicle?.numberPlate || undefined,
      });
    }

    return {
      passengerId,
      latitude,
      longitude,
      drivers,
    };
  }
}