import { ErrorException, toMongoId, toMongoObjectId } from "@libs/common";
import { HttpStatus } from "@nestjs/common";
import { DeviceRepository, DriverDocumentRepository, FavouritesRepository, NotificationRepository, RatingRepository, RidesRepository, TransactionRepository, UserDailyOnlineStatusRepository, UserDetailsRepository, UserRepository, UserTokenMetaRepository, UserVerificationRepository, VehicleRepository, WalletRepository } from "@libs/data-access";
import { Message } from "@libs/localization";
import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

@Injectable()
export class ProfileService {
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
    ) { }

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
                            // Note: RatingRepository needs to be available here
                            const newAverage = await (this.ratingRepository as any).getAverageRatingByUser(ratedToId);
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
}