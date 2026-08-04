import { ErrorException, toMongoId } from "@libs/common";
import { EnvService } from "@libs/common/config/env.service";
import { getActiveProfileImageUrl } from "@libs/common/utils/entity.utils";
import {
  CreateUserDetailsInput,
  DriverOnlineStatus,
  roles,
  UserDetails,
  UserDetailsRepository,
  UserRepository,
  UserDailyOnlineStatusRepository,
  WalletRepository,
  GeoLocationInput,
  UpdateNotificationSettingsInput,
  UpdateNotificationSettingsResponse,
  SaveLocationInput,
  DeleteLocationInput,
  SavedLocationsResponse,
  SavedLocation,
  SavedLocationType,
} from "@libs/data-access";
import {
  ImageStatus,
  UploadPurpose,
} from "@libs/data-access/enums/upload.enum";
import { S3Service } from "@libs/s3";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { RideChannelService } from "@libs/services/ably";
import axios from "axios";

@Injectable()
export class UserDetailsService {
  private readonly logger = new Logger(UserDetailsService.name);

  constructor(
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly userRepository: UserRepository,
    private readonly s3: S3Service,
    private readonly envService: EnvService,
    private readonly userDailyOnlineStatusRepository: UserDailyOnlineStatusRepository,
    private readonly walletRepository: WalletRepository,
  ) { }

  async update(userId: string, input: CreateUserDetailsInput, lang: string) {
    try {
      const user = await this.userRepository.findOne({ _id: toMongoId(userId) });

      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }
      if (input.email && input.email !== user.email) {
        if (await this.userRepository.findByEmail(input.email)) {
          ErrorException(
            null,
            "USER.EMAIL_ALREADY_EXISTS",
            HttpStatus.BAD_REQUEST,
          );
        }
        await this.userRepository.updateById(toMongoId(userId), {
          email: input.email,
        });
      }
      const details = await this.userDetailsRepository.findOne({
        userId: toMongoId(userId),
      });
      if (!details) {
        const profileImagesArr = input.profileImage
          ? [
            {
              s3Key: input.profileImage,
              status: ImageStatus.ACTIVE,
              createdAt: new Date(),
            },
          ]
          : [];
        delete input.profileImage;
        return await this.userDetailsRepository.create({
          userId: toMongoId(userId),
          ...input,
          profileImages: profileImagesArr,
          notificationSettings: { RIDER: { earnings: true, appUpdates: true }, USER: { appUpdates: true, offersAndPromotion: true, ridesUpdate: true } },
        });
      }

      if (
        input.profileImage &&
        details.profileImages.every(
          (img) =>
            img.s3Key !== input.profileImage &&
            img.socialPicture !== input.profileImage,
        )
      ) {
        //set all existing image to inactive
        //set this new one to active status
        details.profileImages.forEach((img) => {
          img.status = ImageStatus.INACTIVE;
        });
        details.profileImages.push({
          ...(input.profileImage.startsWith(
            this.envService.getAwsS3UploadPrefix() +
            "/" +
            UploadPurpose.USER_PROFILE_IMAGE.toLowerCase(),
          )
            ? { s3Key: input.profileImage }
            : { socialPicture: input.profileImage }),
          status: ImageStatus.ACTIVE,
          createdAt: new Date(),
        });
      }
      delete input.profileImage;

      await this.userDetailsRepository.updateOne(
        { userId: toMongoId(userId) },
        { ...input, profileImages: details.profileImages },
      );

      await this.userRepository.updateOne(
        { _id: toMongoId(userId) },
        { profileCompleted: true },
      );

      const updatedCoreUser = await this.userRepository.findOne({
        _id: toMongoId(userId),
      });

      const updatedUserDetails = await this.userDetailsRepository.findOne({
        userId: toMongoId(userId),
      });
      const userDetailsObj: UserDetails & { profileImage?: string } =
        updatedUserDetails.toObject();
      userDetailsObj.profileImage = getActiveProfileImageUrl(
        updatedUserDetails.profileImages,
        (key) => this.s3.getPublicUrl(key),
      );
      delete userDetailsObj.profileImages;

      // Fetch wallet information
      const wallet = await this.walletRepository.findByUserId(userId);

      // Determine totalTrips based on user role
      const isDriver = updatedCoreUser.loginAs === roles.RIDER;
      const totalTrips = isDriver
        ? userDetailsObj.totalRidesAsDriver || 0
        : userDetailsObj.totalTripsAsPassenger || 0;

      // Filter notificationSettings to only include the role the user is logged in as
      const loginAs = updatedCoreUser.loginAs;
      const allNotificationSettings = userDetailsObj.notificationSettings || {};
      const roleNotificationSettings = allNotificationSettings[loginAs] || {};
      delete userDetailsObj.notificationSettings;

      return {
        email: updatedCoreUser.email,
        phoneNumber: updatedCoreUser.phone,
        walletInfo: wallet ? { balance: wallet.balance } : { balance: 0 },
        totalTrips,
        notificationSettings: roleNotificationSettings,
        ...userDetailsObj,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ Update notification settings for the current user (role-specific)
  async updateNotificationSettings(
    userId: string,
    input: UpdateNotificationSettingsInput,
    loginAs: string,
  ): Promise<UpdateNotificationSettingsResponse> {
    try {
      const details = await this.userDetailsRepository.findOne({
        userId: toMongoId(userId),
      });

      if (!details) {
        ErrorException(null, "USER.DETAILS_NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      // Start with existing settings or defaults
      const existingSettings = details.notificationSettings || {
        RIDER: { earnings: true, appUpdates: true },
        USER: { appUpdates: true, offersAndPromotion: true, ridesUpdate: true },
      };

      // Role-specific defaults and validation
      const roleDefaults: Record<string, Record<string, boolean>> = {
        RIDER: { earnings: true, appUpdates: true },
        USER: { appUpdates: true, offersAndPromotion: true, ridesUpdate: true },
      };

      // Get or create settings for the specified role (derived from loginAs)
      const roleSettings = existingSettings[loginAs] || roleDefaults[loginAs] || {};
      const updatedRoleSettings: Record<string, boolean> = { ...roleSettings };

      // Apply only role-appropriate fields
      if (loginAs === roles.RIDER) {
        if (input.earnings !== undefined) updatedRoleSettings.earnings = input.earnings;
        if (input.appUpdates !== undefined) updatedRoleSettings.appUpdates = input.appUpdates;
      } else if (loginAs === roles.USER) {
        if (input.appUpdates !== undefined) updatedRoleSettings.appUpdates = input.appUpdates;
        if (input.offersAndPromotion !== undefined) updatedRoleSettings.offersAndPromotion = input.offersAndPromotion;
        if (input.ridesUpdate !== undefined) updatedRoleSettings.ridesUpdate = input.ridesUpdate;
      }

      const updatedSettings = {
        ...existingSettings,
        [loginAs]: updatedRoleSettings,
      };

      await this.userDetailsRepository.updateOne(
        { userId: toMongoId(userId) },
        { notificationSettings: updatedSettings },
      );

      return {
        role: loginAs,
        earnings: updatedRoleSettings.earnings ?? false,
        appUpdates: updatedRoleSettings.appUpdates ?? false,
        offersAndPromotion: updatedRoleSettings.offersAndPromotion ?? false,
        ridesUpdate: updatedRoleSettings.ridesUpdate ?? false,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ Get current user details (self)
  async findOne(userId: string, lang: string) {
    try {
      const user = await this.userRepository.findOne({ _id: toMongoId(userId) });
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      const details = await this.userDetailsRepository.findOne({ userId: toMongoId(userId) });

      if (!details)
        ErrorException(null, "USER.DETAILS_NOT_FOUND", HttpStatus.NOT_FOUND);
      const toObjectDetails: Record<string, any> = details.toObject();
      const profileImages = details.profileImages.filter((img) => {
        return img.status === ImageStatus.ACTIVE;
      });
      if (profileImages.length > 0) {
        toObjectDetails.profileImage = this.s3.getPublicUrl(
          profileImages[0].s3Key,
        );
      }
      delete toObjectDetails.profileImages;

      // Fetch wallet information
      const wallet = await this.walletRepository.findByUserId(userId);

      // Determine totalTrips based on user role
      const isDriver = user.loginAs === roles.RIDER;
      const totalTrips = isDriver
        ? toObjectDetails.totalRidesAsDriver || 0
        : toObjectDetails.totalTripsAsPassenger || 0;

      // Filter notificationSettings to only include the role the user is logged in as
      const loginAs = user.loginAs;
      const allNotificationSettings = toObjectDetails.notificationSettings || {};
      const roleNotificationSettings = allNotificationSettings[loginAs] || {};
      delete toObjectDetails.notificationSettings;

      return {
        email: user.email,
        phoneNumber: user.phone,
        walletInfo: wallet ? { balance: wallet.balance } : { balance: 0 },
        totalTrips,
        notificationSettings: roleNotificationSettings,
        ...toObjectDetails,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async saveLocation(
    userId: string,
    input: SaveLocationInput,
  ): Promise<SavedLocationsResponse> {
    try {
      const details = await this.userDetailsRepository.findOne({
        userId: toMongoId(userId),
      });

      if (!details) {
        ErrorException(null, "USER.DETAILS_NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      const location: SavedLocation = {
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
      };

      if (input.locationType === SavedLocationType.HOME) {
        await this.userDetailsRepository.updateOne(
          { userId: toMongoId(userId) },
          { $set: { homeLocation: location } },
        );
      } else if (input.locationType === SavedLocationType.WORK) {
        await this.userDetailsRepository.updateOne(
          { userId: toMongoId(userId) },
          { $set: { workLocation: location } },
        );
      }

      return this.getSavedLocations(userId);
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSavedLocations(userId: string): Promise<SavedLocationsResponse> {
    try {
      const details = await this.userDetailsRepository.findOne({
        userId: toMongoId(userId),
      });

      if (!details) {
        ErrorException(null, "USER.DETAILS_NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      return {
        homeLocation: details.homeLocation || null,
        workLocation: details.workLocation || null,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteLocation(
    userId: string,
    input: DeleteLocationInput,
  ): Promise<SavedLocationsResponse> {
    try {
      const details = await this.userDetailsRepository.findOne({
        userId: toMongoId(userId),
      });

      if (!details) {
        ErrorException(null, "USER.DETAILS_NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      if (input.locationType === SavedLocationType.HOME) {
        await this.userDetailsRepository.updateOne(
          { userId: toMongoId(userId) },
          { $set: { homeLocation: null } },
        );
      } else if (input.locationType === SavedLocationType.WORK) {
        await this.userDetailsRepository.updateOne(
          { userId: toMongoId(userId) },
          { $set: { workLocation: null } },
        );
      }

      return this.getSavedLocations(userId);
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getMatchmakingUrl(): string {
    return this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:4000/graphql');
  }

  private async notifyMatchmakingSubscription(driverId: string, status: 'subscribe' | 'unsubscribe'): Promise<void> {
    const matchmakingUrl = this.getMatchmakingUrl();
    const mutation = status === 'subscribe'
      ? `mutation Subscribe($driverId: String!) { subscribeToDriverLocationChannel(driverId: $driverId) { success message } }`
      : `mutation Unsubscribe($driverId: String!) { unsubscribeFromDriverLocationChannel(driverId: $driverId) { success message } }`;

    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        { query: mutation, variables: { driverId } },
        { timeout: 10000 },
      );
      const result = response.data?.data;
      if (status === 'subscribe') {
        this.logger.log(`Matchmaking subscription for driver ${driverId}: ${result?.subscribeToDriverLocationChannel?.message || 'OK'}`);
      } else {
        this.logger.log(`Matchmaking unsubscription for driver ${driverId}: ${result?.unsubscribeFromDriverLocationChannel?.message || 'OK'}`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to ${status} matchmaking for driver ${driverId}: ${error?.message || error}`);
    }
  }

  async setOnlineStatus(
    userId: string,
    driverOnlineStatus: DriverOnlineStatus,
    location: GeoLocationInput,
  ): Promise<UserDetails> {
    const today = new Date().toISOString().split("T")[0]; // 'YYYY-MM-DD'

    // Determine user role to know if they are a driver (RIDER) or passenger (USER)
    const user = await this.userRepository.findOne({ _id: toMongoId(userId) });
    const isDriver = user?.loginAs === roles.RIDER;

    if (driverOnlineStatus === DriverOnlineStatus.ONLINE) {
      // User is coming online - set lastOnlineAt timestamp
      await this.userDailyOnlineStatusRepository.findOneAndUpdate(
        { userId: toMongoId(userId), date: today },
        {
          $set: {
            lastOnlineAt: new Date(),
            userId: toMongoId(userId),
            date: today,
          },
        },
        { upsert: true, new: true },
      );

      // Subscribe to location channel based on user role
      if (isDriver) {
        await this.notifyMatchmakingSubscription(userId, 'subscribe');
      }
    } else if (driverOnlineStatus === DriverOnlineStatus.OFFLINE) {
      // User is going offline - calculate elapsed time since lastOnlineAt and add to totalOnlineSeconds
      const record = await this.userDailyOnlineStatusRepository.findOne({
        userId: toMongoId(userId),
        date: today,
      });

      if (record && record.lastOnlineAt) {
        const elapsedSeconds = Math.floor(
          (Date.now() - record.lastOnlineAt.getTime()) / 1000,
        );
        if (elapsedSeconds > 0) {
          await this.userDailyOnlineStatusRepository.updateOne(
            { _id: record._id },
            {
              $inc: { totalOnlineSeconds: elapsedSeconds },
              $set: { lastOnlineAt: null },
            },
          );
        }
      }

      // Unsubscribe from location channel based on user role
      if (isDriver) {
        await this.notifyMatchmakingSubscription(userId, 'unsubscribe');
      }
    }

    // Use driver-specific channel for riders, passenger-specific channel for users
    const locationChannelId = isDriver
      ? RideChannelService.getDriverLocationChannelName(userId)
      : RideChannelService.getPassengerLocationChannelName(userId);

    return this.userDetailsRepository.setOnlineStatus(
      userId,
      driverOnlineStatus,
      locationChannelId,
      location,
    );
  }
}