import { ErrorException, toMongoId } from "@libs/common";
import { CreateUserDetailsInput, DriverOnlineStatus, UserDetailsRepository, UserRepository } from "@libs/data-access";
import { ImageStatus, UploadPurpose } from "@libs/data-access/enums/upload.enum";
import { S3Service } from "@libs/s3";
import { HttpStatus, Injectable } from "@nestjs/common";
import { stat } from "fs";
import { Types } from "mongoose";


@Injectable()
export class UserDetailsService {
  constructor(
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly userRepository: UserRepository,
    private readonly s3: S3Service
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

      if (input.profileImage && details.profileImages.every(img => img.s3Key !== input.profileImage)) {
        //set all existing image to inactive
        //set this new one to active status
        details.profileImages.forEach(img => {
          img.status = ImageStatus.INACTIVE;
        });
        details.profileImages.push({
          ...(input.profileImage.startsWith(UploadPurpose.USER_PROFILE_IMAGE.toLowerCase()) ? {s3Key: input.profileImage} : {socialPicture:input.profileImage}),
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

      return {
        email: updatedCoreUser.email,
        ...updatedUserDetails.toObject(),
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
const toObjectDetails:Record<string, any> = details.toObject();
 const profileImages = details.profileImages.filter(img => {
        return img.status === ImageStatus.ACTIVE
          
     
      });
      if(profileImages.length > 0) {
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
    return this.userDetailsRepository.setOnlineStatus(userId, driverOnlineStatus);
  }
}