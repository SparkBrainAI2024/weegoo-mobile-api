import { CursorPaginationInput } from '@libs/data-access/base/base.input';
// Use direct relative imports for notification-related types
import { Notification } from '@libs/data-access/entities/notification.entity';
import { NotificationRepository } from '@libs/data-access/repositories/notification.repository';
import { CreateNotificationInput } from '@libs/data-access/dtos/input/create-notification.input';
// Direct import for other repositories to avoid barrel circularity
import { UserTokenMetaRepository } from '@libs/data-access/repositories/user-token-meta.repository';

import { Types } from 'mongoose';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { groupItemsByDate } from '@libs/common/utils/group-by-date.utils';
import { ErrorException } from '@libs/common/exceptions';
import { FirebaseMessagingService } from '@libs/services/firebase-messaging';
import { toMongoId } from '@libs/common';
import { NotificationType, roles, TokenGrantType } from '@libs/data-access';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class NotificationService {
    constructor(
        @Inject(forwardRef(() => NotificationRepository))
        private readonly notificationRepository: NotificationRepository,
        private readonly firebaseMessagingService: FirebaseMessagingService,
        @Inject(forwardRef(() => UserTokenMetaRepository))
        private readonly userTokenRepository: UserTokenMetaRepository,
        @InjectConnection() private readonly connection: Connection,
    ) { }

    /**
      * Retrieves a paginated list of notification rides for a given user. The method accepts the user object and pagination options, and returns a paginated response containing the user's favourite rides. The pagination options can include page number, limit, sorting, and filtering criteria to customize the results.
      * @param user - The user for whom to retrieve favourite rides
      * @param options - Pagination and filtering options
      * @returns A paginated list of the user's favourite rides
     */
    async findNotificationWithListingAndGrouping(
        user: { _id: Types.ObjectId },
        options: CursorPaginationInput,
    ) {
        const filter = {
            userId: user._id,
            deleted: false

        }
        const { data, pageInfo } = await this.notificationRepository.getNotificationsByUserId(user._id.toString(), options);
        const groupedData = groupItemsByDate(data);
        return {
            data: groupedData,
            pageInfo: {
                nextCursor: pageInfo.nextCursor,
                hasNextPage: pageInfo.hasNextPage
            }
        }
    }

    /**
     creates a new favourite entry for a user. The favouriteData should include necessary details such as passengerId, rideId, and any other relevant information. The method returns the created FavouritesDocument.
     * @param favouriteData - Partial data for creating a favourite entry
     * @returns The created FavouritesDocument
     */
    async createNotification(notificationPayload: CreateNotificationInput, user: { loginAs: string; _id: Types.ObjectId }): Promise<Notification> {
        const roles = user.loginAs;
        const userId = user._id;
        const newNotificationPayload = { ...notificationPayload, roles, userId };
        const notification = await this.notificationRepository.create({ ...newNotificationPayload as any });
        const token = await this.userTokenRepository.findOne({ userId: userId, grant: TokenGrantType.REFRESH_TOKEN }, null, null, { sort: { createdAt: -1 } });
        if (token?.firebaseToken) {
            const firebaseData: Record<string, string> = {
                title: notification.title,
                body: notification.description,
                notificationType: String(notification.notificationType),
                notificationId: notification._id.toString(),
                desc: notification.description,
            };
            // Include ablyChannelId if present in the notification payload
            if ((notificationPayload as any).ablyChannelId) {
                firebaseData.ablyChannelId = (notificationPayload as any).ablyChannelId;
            }
            if ((notificationPayload as any).waitTimeSeconds) {
                firebaseData.waitTimeSeconds = (notificationPayload as any).waitTimeSeconds.toString();
            }
            // Include all ride-related fields (nullable) in the Firebase payload
            const payload = notificationPayload as any;
            if (payload.rideId) {
                firebaseData.rideId = payload.rideId;
            }
            if (payload.noOfPassengers) {
                firebaseData.noOfPassengers = String(payload.noOfPassengers);
            }
            if (payload.rideType) {
                firebaseData.rideType = payload.rideType;
            }

            if (payload.rideStatus) {
                firebaseData.rideStatus = payload.rideStatus;
            }
            if (payload.pickupLocation) {
                firebaseData.pickupLocation = JSON.stringify(payload.pickupLocation);
            }
            if (payload.dropoffLocation !== undefined) {
                firebaseData.dropoffLocation = payload.dropoffLocation ? JSON.stringify(payload.dropoffLocation) : 'null';
            }
            if (payload.distanceInKm !== undefined && payload.distanceInKm !== null) {
                firebaseData.distanceInKm = String(payload.distanceInKm);
            }
            if (payload.estimatedTimeInMinutes !== undefined && payload.estimatedTimeInMinutes !== null) {
                firebaseData.estimatedTimeInMinutes = String(payload.estimatedTimeInMinutes);
            }
            if (payload.passengerId) {
                firebaseData.passengerId = payload.passengerId;
            }
            if (payload.driverScore !== undefined && payload.driverScore !== null) {
                firebaseData.driverScore = String(payload.driverScore);
            }
            if (payload.distanceToPickupKm !== undefined && payload.distanceToPickupKm !== null) {
                firebaseData.distanceToPickupKm = String(payload.distanceToPickupKm);
            }
            if (payload.estimatedFare !== undefined && payload.estimatedFare !== null) {
                firebaseData.estimatedFare = String(payload.estimatedFare);
            }
            // Include passenger info fields
            if (payload.passengerName) {
                firebaseData.passengerName = payload.passengerName;
            }
            if (payload.passengerPhone) {
                firebaseData.passengerPhone = payload.passengerPhone;
            }
            if (payload.passengerGender) {
                firebaseData.passengerGender = payload.passengerGender;
            }
            if (payload.passengerProfileImages && Array.isArray(payload.passengerProfileImages) && payload.passengerProfileImages.length > 0) {
                firebaseData.passengerProfileImages = JSON.stringify(payload.passengerProfileImages);
            }
            // Include driver info fields
            if (payload.driverName) {
                firebaseData.driverName = payload.driverName;
            }
            if (payload.driverPhone) {
                firebaseData.driverPhone = payload.driverPhone;
            }
            if (payload.driverProfileImage) {
                firebaseData.driverProfileImage = payload.driverProfileImage;
            }
            if (payload.driverRating !== undefined && payload.driverRating !== null) {
                firebaseData.driverRating = String(payload.driverRating);
            }
            // Include vehicle info fields
            if (payload.vehicleType) {
                firebaseData.vehicleType = payload.vehicleType;
            }
            if (payload.vehicleModel) {
                firebaseData.vehicleModel = payload.vehicleModel;
            }
            if (payload.vehicleColor) {
                firebaseData.vehicleColor = payload.vehicleColor;
            }
            if (payload.vehicleNumberPlate) {
                firebaseData.vehicleNumberPlate = payload.vehicleNumberPlate;
            }
            // Include passenger/driver snapshot fields
            if (payload.passengerSnapshot) {
                firebaseData.passenger = JSON.stringify(payload.passengerSnapshot);
            }
            if (payload.driverSnapshot) {
                firebaseData.driver = JSON.stringify(payload.driverSnapshot);
            }
            console.log("payload", payload)
            try {
                await this.firebaseMessagingService.sendSingleMessage(token.firebaseToken, {
                    token: token.firebaseToken,

                    notification: {
                        title: notification.title,
                        body: notification.description,
                    },

                    data: firebaseData,

                    android: {
                        priority: 'high',
                        notification: {
                            priority: 'high',
                            sound: 'default',
                        },
                    },

                    apns: {
                        headers: {
                            'apns-priority': '10',
                        },
                        payload: {
                            aps: {
                                sound: 'default',
                                badge: 1,
                            },
                        },
                    },
                });
            } catch (e) {
                console.log("============NOTIFIICATION ERROR", e)
            }
        }

        console.log("========firebase token=====", token?.firebaseToken)
        return notification;
    }


    /**Validation for notification */
    async validateNotificationOwnership(notificationId: string, userId: string): Promise<Notification> {
        const notification = await this.notificationRepository.findOne({ _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) });
        if (!notification) {
            return ErrorException(null, "NOTIFICATION.NOTIFICATION_NOT_FOUND", 404);
        }
        if (notification.readAt) {
            return ErrorException(null, "NOTIFICATION.NOTIFICATION_ALREADY_READ", 400);
        }
        if (notification.userId.toString() !== userId) {
            return ErrorException(null, "NOTIFICATION.NOTIFICATION_USER_MISMATCH", 403);
        }
        return notification;
    }
    /** get rides by favourite id and passenger Id */

    async setNotificationAsRead(notificationId: string, userId: string): Promise<Notification | null> {

        return this.notificationRepository.setNotificationAsRead(
            notificationId,
            userId,
        );
    }

    async setNotificationOpen(userId: string): Promise<Notification | null> {

        return this.notificationRepository.setNotificationOpen(
            userId
        );
    }
    async countUnreadAndUnopenedNotifications(userId: string): Promise<number> {
        return this.notificationRepository.countUnreadAndUnopenedNotifications(
            userId
        );
    }

    /**
     * Broadcast a promo/offer notification to a list of riders.
     * Creates in-app notifications and sends Firebase push notifications.
     * Designed for background/fire-and-forget broadcast pattern.
     */
    async broadcastPromoCodeToRiders(
        userIds: string[],
        promoPayload: {
            title: string;
            description: string;
            promoCodeId: string;
            discountType: string;
            percentageAmount?: number;
            flatAmount?: number;
            minimumFare?: number;
            startDateTime: Date;
            expiryDateTime: Date;
            offerAvailableTime: Date;
            appliedTo: string;
            promoCode: string;
        },
    ): Promise<{ success: boolean; notifiedCount: number }> {
        const notifiedCount = userIds.length;
        // For large recipient lists, fire-and-forget pattern: don't await all individually
        for (const userId of userIds) {
            const createPromise = (async () => {
                const notificationPayload = {
                    title: promoPayload.title,
                    description: promoPayload.description,
                    notificationType: NotificationType.PROMOCODE_PROMOTION as any,
                    userId,
                    roles: roles.USER,
                    promoCodeId: promoPayload.promoCodeId,
                    discountType: promoPayload.discountType,
                    percentageAmount: promoPayload.percentageAmount,
                    flatAmount: promoPayload.flatAmount,
                    minimumFare: promoPayload.minimumFare,
                    startDateTime: promoPayload.startDateTime,
                    expiryDateTime: promoPayload.expiryDateTime,
                    offerAvailableTime: promoPayload.offerAvailableTime,
                    appliedTo: promoPayload.appliedTo,
                    promocode: promoPayload.promoCode,
                };

                try {
                    const notification = await this.createNotification(
                        notificationPayload as any,
                        { loginAs: roles.USER, _id: new Types.ObjectId(userId) } as any,
                    );

                    const token = await this.userTokenRepository.findOne(
                        { userId: new Types.ObjectId(userId), grant: TokenGrantType.REFRESH_TOKEN },
                        null,
                        null,
                        { sort: { createdAt: -1 } },
                    );

                    if (token?.firebaseToken) {
                        await this.firebaseMessagingService.sendSingleMessage(token.firebaseToken, {
                            token: token.firebaseToken,
                            notification: {
                                title: promoPayload.title,
                                body: promoPayload.description,
                            },
                            data: {
                                notificationId: notification._id.toString(),
                                notificationType: 'PROMO_CODE',
                                promoCode: promoPayload.promoCode,
                                discountType: promoPayload.discountType,
                                flatAmount: String(promoPayload.flatAmount || 0),
                                percentageAmount: String(promoPayload.percentageAmount || 0),
                                expiryDateTime: promoPayload.expiryDateTime.toISOString(),
                            },
                            android: { priority: 'high', notification: { priority: 'high', sound: 'default' } },
                            apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default', badge: 1 } } },
                        });
                    }
                } catch (err) {
                    console.error(`Failed to notify user ${userId}:`, err);
                }
            })();

            // Fire-and-forget: allow broadcast to run in background
            createPromise.catch((err) =>
                console.error(`Unhandled broadcast error for user ${userId}:`, err),
            );
        }

        return { success: true, notifiedCount };
    }

}
