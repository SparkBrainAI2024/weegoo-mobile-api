import { ErrorException, toMongoId } from "@libs/common";
import { EnvService } from "@libs/common/config/env.service";
import { getActiveProfileImageUrl } from "@libs/common/utils/entity.utils";
import { CreateUserDetailsInput, DriverOnlineStatus, UserDetails, UserDetailsRepository, UserRepository, UserDailyOnlineStatusRepository } from "@libs/data-access";
import { ImageStatus, UploadPurpose } from "@libs/data-access/enums/upload.enum";
import { S3Service } from "@libs/s3";
import { HttpStatus, Injectable } from "@nestjs/common";


@Injectable()
export class UserDetailsService {
  constructor(
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly userRepository: UserRepository,
    private readonly s3: S3Service,
    private readonly envService: EnvService,
    private readonly userDailyOnlineStatusRepository: UserDailyOnlineStatusRepository,
  ) { }

  async update(userId: string, input: CreateUserDetailsInput, lang: string) {
    try {
      const user = await this.userRepository.findOne({ _id: userId });

      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }
      if (input.email && input.email !== user.email) {
        if (await this.userRepository.findByEmail(input.email)) {
          ErrorException(null, "USER.EMAIL_ALREADY_EXISTS", HttpStatus.BAD_REQUEST);
        }
        await this.userRepository.updateById(toMongoId(userId), { email: input.email });
      }
      const details = await this.userDetailsRepository.findOne({ userId: toMongoId(userId) });
      if (!details) {
        const profileImagesArr = input.profileImage ? [{
          s3Key: input.profileImage,
          status: ImageStatus.ACTIVE,
          createdAt: new Date(),
        }] : [];
        delete input.profileImage;
        return await this.userDetailsRepository.create({ userId: toMongoId(userId), ...input, profileImages: profileImagesArr });
      }

      if (input.profileImage && details.profileImages.every(img => (img.s3Key !== input.profileImage && img.socialPicture !== input.profileImage))) {
        //set all existing image to inactive
        //set this new one to active status
        details.profileImages.forEach(img => {
          img.status = ImageStatus.INACTIVE;
        });
        details.profileImages.push({
          ...(input.profileImage.startsWith(this.envService.getAwsS3UploadPrefix() + "/" + UploadPurpose.USER_PROFILE_IMAGE.toLowerCase()) ? { s3Key: input.profileImage } : { socialPicture: input.profileImage }),
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
      const userDetailsObj: UserDetails & { profileImage?: string } = updatedUserDetails.toObject();
      userDetailsObj.profileImage = getActiveProfileImageUrl(updatedUserDetails.profileImages, (key) => this.s3.getPublicUrl(key));
      delete userDetailsObj.profileImages;
      return {
        email: updatedCoreUser.email,
        ...userDetailsObj
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
      const user = await this.userRepository.findOne({ _id: userId });
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      const details = await this.userDetailsRepository.findOne({ userId });

      if (!details)
        ErrorException(null, "USER.DETAILS_NOT_FOUND", HttpStatus.NOT_FOUND);
      const toObjectDetails: Record<string, any> = details.toObject();
      const profileImages = details.profileImages.filter(img => {
        return img.status === ImageStatus.ACTIVE


      });
      if (profileImages.length > 0) {
        toObjectDetails.profileImage = this.s3.getPublicUrl(profileImages[0].s3Key);
      }
      delete toObjectDetails.profileImages;

      return { email: user.email, ...toObjectDetails };

    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async setOnlineStatus(userId: string, driverOnlineStatus: DriverOnlineStatus) {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    
    if (driverOnlineStatus === DriverOnlineStatus.ONLINE) {
      // User is coming online - set lastOnlineAt timestamp
      await this.userDailyOnlineStatusRepository.findOneAndUpdate(
        { userId: toMongoId(userId), date: today },
        { $set: { lastOnlineAt: new Date(), userId: toMongoId(userId), date: today } },
        { upsert: true, new: true },
      );
    } else if (driverOnlineStatus === DriverOnlineStatus.OFFLINE) {
      // User is going offline - calculate elapsed time since lastOnlineAt and add to totalOnlineSeconds
      const record = await this.userDailyOnlineStatusRepository.findOne({
        userId: toMongoId(userId),
        date: today,
      });
      
      if (record && record.lastOnlineAt) {
        const elapsedSeconds = Math.floor((Date.now() - record.lastOnlineAt.getTime()) / 1000);
        if (elapsedSeconds > 0) {
          await this.userDailyOnlineStatusRepository.updateOne(
            { _id: record._id },
            { $inc: { totalOnlineSeconds: elapsedSeconds }, $set: { lastOnlineAt: null } },
          );
        }
      }
    }

    return this.userDetailsRepository.setOnlineStatus(userId, driverOnlineStatus);
  }
}