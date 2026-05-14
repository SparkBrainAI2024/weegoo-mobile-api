import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';
import { Types } from 'mongoose';
import { verificationType } from '../enums/user.enum';
import { ErrorException } from '@libs/common/exceptions';
import { UserVerification, UserVerificationDocument } from '../entities/user-verfication.entity';
import { UTCTime } from '@libs/common/utils/datetime';
import { toMongoId } from '@libs/common';

@Injectable()
export class UserVerificationRepository extends BaseRepository<UserVerificationDocument> {
  constructor(@InjectModel(UserVerification.name) private readonly _model: BaseModel<UserVerificationDocument>) {
    super(_model);
  }
    async deleteOtpById(id: Types.ObjectId) {
        try {
            return await this.model.findByIdAndDelete(id)
        } catch (e) {
           ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async sendEmailVerificationOtp(userId: Types.ObjectId, otp: number) {
        try {
            await this.model.findOneAndDelete({ type: verificationType.VERIFICATION_EMAIL, userId, otp })
            return await this.create({
                type: verificationType.VERIFICATION_EMAIL,
                userId: userId,
                otp,
                createdAt: UTCTime()
            })
        } catch (e) {
            ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
        }

    }
    async sendResetPasswordOtp(userId: Types.ObjectId, otp: number) {
        try {
            await this.model.findOneAndDelete({ type: verificationType.RESET_PASSWORD, userId, otp })
            return await this.create({
                type: verificationType.RESET_PASSWORD,
                userId: userId,
                otp,
                createdAt: UTCTime()
            })
        } catch (e) {
            ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
        }

    }

    async sendPhoneVerificationOtp(userId: Types.ObjectId, otp: number) {
        try {
            await this.model.findOneAndDelete({ type: verificationType.VERIFICATION_PHONE, userId, otp })
            return await this.create({
                type: verificationType.VERIFICATION_PHONE,
                userId: toMongoId(userId.toString()),
                otp,
                createdAt: UTCTime()
            })
        } catch (e) {
            ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async sendOtp(userId: Types.ObjectId, otp: number, type: string) {
        try {
            await this.model.deleteMany({ type, userId });
            return await this.create({
                type,
                userId: toMongoId(userId.toString()),
                otp,
                createdAt: UTCTime()
            });
        } catch (e) {
            ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

}