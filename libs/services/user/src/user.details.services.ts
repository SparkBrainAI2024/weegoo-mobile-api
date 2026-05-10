import { ErrorException, toMongoId } from "@libs/common";
import { CreateUserDetailsInput, UserDetailsRepository, UserRepository } from "@libs/data-access";
import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";


@Injectable()
export class UserDetailsService {
  constructor(
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly userRepository: UserRepository,
  ) { }

  async update(userId: string, input: CreateUserDetailsInput, lang: string) {
    try {
      const user = await this.userRepository.findOne({ _id: userId });

      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }
      if (input.phone) {
        if (await this.userRepository.findByPhone(input.phone)) {
          ErrorException(null, "USER.PHONE_ALREADY_EXISTS", HttpStatus.BAD_REQUEST);
        }
        await this.userRepository.updateById(toMongoId(userId), { phone: input.phone });
      }
      const details = await this.userDetailsRepository.findOne({ userId: toMongoId(userId) });
      if (!details)
        return await this.userDetailsRepository.create({ userId: toMongoId(userId), ...input });

      const updatedUser = await this.userDetailsRepository.updateOne(
        { userId: toMongoId(userId) },
        { ...input },
      );

      await this.userRepository.updateOne(
        { _id: toMongoId(userId) },
        { profileCompleted: true },
      );

      const updatedCoreUser = await this.userRepository.findOne({
        _id: toMongoId(userId),
      });
      return {
        email: updatedCoreUser.email,
        phone: updatedCoreUser.phone,
        ...updatedUser.toObject(),
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

      return { email: user.email, phone: user.phone, ...details.toObject() };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
