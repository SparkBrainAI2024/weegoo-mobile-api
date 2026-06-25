import { comparePassword, ErrorException, hashPassword, passwordSalt, tokenTypes, toMongoId, toMongoObjectId } from "@libs/common";
import { ChangePasswordInput, DeviceRepository, language, UserDetailsDocument, UserDetailsRepository, UserDocument, UserRepository, UserTokenMetaRepository } from "@libs/data-access";
import { Message } from "@libs/localization";
import { HttpStatus, Injectable } from "@nestjs/common";
import { EnvService } from "@libs/common/config/env.service";
import { generateMongoDbId } from "@libs/common/utils/id.generator";
import { generateToken } from "@libs/common/utils/jwt";
import { Types } from "mongoose";

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly deviceRepository: DeviceRepository,
        private readonly userDetailsRepository: UserDetailsRepository,
        private readonly userTokenMetaRepository: UserTokenMetaRepository,
        private readonly envService: EnvService,
    ) { }

    private async createAuthTokens(
        userId: Types.ObjectId | string,
        email: string,
        deviceId: string = null,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const accessTokenJti = generateMongoDbId();
        const refreshTokenJti = generateMongoDbId();

        const accessTokenData = {
            id: userId,
            email,
            jti: accessTokenJti,
            grant: 'access',
            type: tokenTypes.accessToken,
            deviceId,
        };
        const refreshTokenData = {
            id: userId,
            email,
            jti: refreshTokenJti,
            grant: 'refresh_token',
            type: tokenTypes.refreshToken,
            deviceId,
        };

        const [accessToken, refreshToken] = await Promise.all([
            generateToken(accessTokenData, this.envService.getJwtSecretKey(), {
                expiresIn: this.envService.getAccessTokenLife(),
            }),
            generateToken(refreshTokenData, this.envService.getJwtSecretKey(), {
                expiresIn: this.envService.getRefreshTokenLife(),
            }),
        ]);

        await this.userTokenMetaRepository.createSessionMeta(
            typeof userId === 'string' ? new Types.ObjectId(userId) : userId as Types.ObjectId,
            deviceId,
            accessTokenJti.toString(),
            refreshTokenJti.toString(),
            email || '',
        );

        return { accessToken, refreshToken };
    }

    async logOut(deviceId: string, userId: string, lang: string) {
        try {
            await this.deviceRepository.logout(userId, deviceId);
            await this.userTokenMetaRepository.deleteByUserAndDevice(userId, deviceId);
            return { message: Message(lang, "USER.LOGGED_OUT"), success: true };
        } catch (e) {
            ErrorException(
                e,
                "COMMON.INTERNAL_SERVER_ERROR",
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async changePassword(
        changePasswordInput: ChangePasswordInput,
        userId: string,
        lang: string
    ) {
        try {
            const { newPassword, oldPassword } = changePasswordInput;
            const user: UserDocument = await this.userRepository.findOne({
                _id: userId,
            });
            if (!user) {
                ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
            }
            const checkPassword = await comparePassword(oldPassword, user.password);
            if (!checkPassword) {
                ErrorException(null, "USER.INCORRECT_PASSWORD", HttpStatus.BAD_REQUEST);
            }
            await this.userRepository.updateOne(
                { _id: user._id },
                { password: await hashPassword(newPassword, passwordSalt) }
            );
            return { message: Message(lang, "USER.PASSWORD_UPDATED"), success: true };
        } catch (e) {
            ErrorException(
                e,
                "COMMON.INTERNAL_SERVER_ERROR",
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async changeLanguage(language: language, userId: string) {
        try {
            await this.userRepository.updateOne(
                {
                    _id: userId,
                },
                { language: language }
            );
            return {
                message: Message(language, "USER.LANGUAGE_UPDATED"),
                success: true,
            };
        } catch (e) {
            ErrorException(
                e,
                "COMMON.INTERNAL_SERVER_ERROR",
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async getUserById(userId: string) {
        try {
            const user: UserDocument = await this.userRepository.findOne({
                _id: userId,
            });
            const userDetails: UserDetailsDocument =
                await this.userDetailsRepository.findOne({
                    userId: user._id,
                });
            if (!user || !userDetails) {
                ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
            }
            return {
                _id: user._id,
                email: user.email,
                verified: user.verified,
                language: user.language,
                suspended: user.suspended,
                profileCompleted: user.profileCompleted,
                loginAs: user.loginAs,
                userDetails: userDetails,
            };
        } catch (e) {
            ErrorException(
                e,
                "COMMON.INTERNAL_SERVER_ERROR",
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    // async verifyChangeEmailOTP(
    //     verifyOTPlInput: VerifyEmailInput,
    //     lang: string,
    //     userId
    // ) {
    //     try {
    //         const { email, otp } = verifyOTPlInput;
    //         const user: UserDocument = await this.userRepository.findOne({
    //             _id: userId,
    //         });
    //         if (!user) {
    //             ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
    //         }
    //         if (user.suspended) {
    //             ErrorException(null, "USER.SUSPENDED", HttpStatus.UNAUTHORIZED);
    //         }
    //         const code = await this.userVerificationRepository.findOne({
    //             userId: user._id,
    //             otp: otp,
    //             type: verificationType.VERIFICATION_EMAIL,
    //         });
    //         if (!code) {
    //             ErrorException(null, "USER.INVALID_OTP", HttpStatus.BAD_REQUEST);
    //         }
    //         await this.userVerificationRepository.deleteOtpById(code._id);

    //         await this.userRepository.updateOne({ _id: userId }, { email });
    //         return { message: Message(lang, "USER.CHANGED_EMAIL"), success: true };
    //     } catch (e) {
    //         ErrorException(
    //             e,
    //             "COMMON.INTERNAL_SERVER_ERROR",
    //             HttpStatus.INTERNAL_SERVER_ERROR
    //         );
    //     }
    // }
}