import { comparePassword, ErrorException, hashPassword, passwordSalt, tokenTypes, toMongoId, toMongoObjectId } from "@libs/common";
import { ChangePasswordInput, DeviceRepository, FavouritesRepository, NotificationRepository, RatingRepository, VehicleRepository, DriverDocumentRepository, language, UpdatePhoneInput, UserDetailsDocument, UserDetailsRepository, UserDocument, UserRepository, UserVerificationRepository, verificationType, VerifyEmailInput, UserTokenMetaRepository, SetPasswordInput, RidesRepository, TransactionRepository, WalletRepository, UserDailyOnlineStatusRepository } from "@libs/data-access";
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
        private readonly userVerificationRepository: UserVerificationRepository,
        private readonly userDetailsRepository: UserDetailsRepository,
        private readonly userTokenMetaRepository: UserTokenMetaRepository,
        private readonly ridesRepository: RidesRepository,
        private readonly transactionRepository: TransactionRepository,
        private readonly walletRepository: WalletRepository,
        private readonly userDailyOnlineStatusRepository: UserDailyOnlineStatusRepository,
        private readonly favouritesRepository: FavouritesRepository,
        private readonly notificationRepository: NotificationRepository,
        private readonly ratingRepository: RatingRepository,
        private readonly vehicleRepository: VehicleRepository,
        private readonly driverDocumentRepository: DriverDocumentRepository,
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

    async getDeleteAccountWarnings(userId: string, loginAs: string) {
        try {
            const warnings: string[] = [];
            const userObjectId = new Types.ObjectId(userId);

            // Check for active rides based on role (driver vs rider)
            if (loginAs === 'RIDER') {
                // Driver: check rides where user is driver
                const activeDriverRides = await this.ridesRepository.findActiveRidesByDriverId(userId);
                if (activeDriverRides && activeDriverRides.length > 0) {
                    warnings.push(`You have ${activeDriverRides.length} active ride(s) as a driver. Please complete or cancel them before deleting your account.`);
                }

                const upcomingDriverRides = await this.ridesRepository.findUpcomingRidesByDriverId(userId);
                if (upcomingDriverRides && upcomingDriverRides.length > 0) {
                    warnings.push(`You have ${upcomingDriverRides.length} upcoming scheduled ride(s) as a driver.`);
                }
            } else {
                // Rider/passenger: check rides where user is passenger
                const activePassengerRides = await this.ridesRepository.findActiveRidesByPassengerId(userId);
                if (activePassengerRides && activePassengerRides.length > 0) {
                    warnings.push(`You have ${activePassengerRides.length} active ride(s) as a passenger. Please complete or cancel them before deleting your account.`);
                }

                const upcomingPassengerRides = await this.ridesRepository.findUpcomingRidesByPassengerId(userId);
                if (upcomingPassengerRides && upcomingPassengerRides.length > 0) {
                    warnings.push(`You have ${upcomingPassengerRides.length} upcoming scheduled ride(s) as a passenger.`);
                }
            }

            // Check wallet balance
            const wallet = await this.walletRepository.findByUserId(userId);
            if (wallet && wallet.balance > 0) {
                warnings.push(`You have a wallet balance of ${wallet.balance}. This will be lost upon account deletion.`);
            }

            return {
                canDelete: warnings.length === 0,
                warnings,
            };
        } catch (e) {
            ErrorException(
                e,
                "COMMON.INTERNAL_SERVER_ERROR",
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async deleteAccount(userId: string, loginAs: string) {
        try {
            const userObjectId = new Types.ObjectId(userId);

            // Check for blocking rides first (not inside transaction)
            if (loginAs === 'RIDER') {
                const activeDriverRides = await this.ridesRepository.findActiveRidesByDriverId(userId);
                if (activeDriverRides && activeDriverRides.length > 0) {
                    throw new Error(`You have ${activeDriverRides.length} active ride(s) as a driver. Please complete or cancel them before deleting your account.`);
                }
                const upcomingDriverRides = await this.ridesRepository.findUpcomingRidesByDriverId(userId);
                if (upcomingDriverRides && upcomingDriverRides.length > 0) {
                    throw new Error(`You have ${upcomingDriverRides.length} upcoming scheduled ride(s) as a driver.`);
                }
            } else {
                const activePassengerRides = await this.ridesRepository.findActiveRidesByPassengerId(userId);
                if (activePassengerRides && activePassengerRides.length > 0) {
                    throw new Error(`You have ${activePassengerRides.length} active ride(s) as a passenger. Please complete or cancel them before deleting your account.`);
                }
                const upcomingPassengerRides = await this.ridesRepository.findUpcomingRidesByPassengerId(userId);
                if (upcomingPassengerRides && upcomingPassengerRides.length > 0) {
                    throw new Error(`You have ${upcomingPassengerRides.length} upcoming scheduled ride(s) as a passenger.`);
                }
            }

            // Before deleting ratings, find users who received ratings from this user
            // so we can recalculate their average rating after deletion
            const affectedRatedToUsers = await this.ratingRepository['model'].distinct('ratedTo', { ratedBy: userObjectId });

            // Run all deletions in parallel (no transaction support for deleteMany in this setup)
            await Promise.all([
                this.transactionRepository['model'].deleteMany({ $or: [{ riderId: userObjectId }, { driverId: userObjectId }] }),
                this.walletRepository.deleteByUserId(userId),
                this.deviceRepository['model'].deleteMany({ userId: userObjectId }),
                this.userTokenMetaRepository['model'].deleteMany({ $or: [{ userId: userObjectId }, { adminId: userObjectId }] }),
                this.userVerificationRepository['model'].deleteMany({ userId: userObjectId }),
                this.userDetailsRepository['model'].deleteMany({ userId: userObjectId }),
                this.userDailyOnlineStatusRepository.deleteMany({ userId: userObjectId }),
                this.favouritesRepository['model'].deleteMany({ userId: userObjectId }),
                this.notificationRepository['model'].deleteMany({ userId: userObjectId }),
                this.ratingRepository['model'].deleteMany({ $or: [{ ratedBy: userObjectId }, { ratedTo: userObjectId }] }),
                this.vehicleRepository['model'].deleteMany({ userId: userObjectId }),
                this.driverDocumentRepository['model'].deleteMany({ userId: userObjectId }),
                this.userRepository.deleteOne({ _id: userObjectId }),
            ]);

            // Recalculate average rating for users who received ratings from the deleted user
            if (affectedRatedToUsers && affectedRatedToUsers.length > 0) {
                await Promise.all(
                    affectedRatedToUsers.map(async (ratedToId: Types.ObjectId) => {
                        try {
                            const newAverage = await this.ratingRepository.getAverageRatingByUser(ratedToId);
                            await this.userDetailsRepository.updateOne(
                                { userId: ratedToId },
                                { rating: newAverage }
                            );
                        } catch (e) {
                            // Ignore errors for individual rating updates
                        }
                    })
                );
            }

            return { message: "Account deleted successfully", success: true };
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