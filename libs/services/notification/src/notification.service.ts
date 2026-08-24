import { CursorPaginationInput } from '@libs/data-access/base/base.input';
// Use direct relative imports for notification-related types
import { Notification } from '@libs/data-access/entities/notification.entity';
import { NotificationRepository } from '@libs/data-access/repositories/notification.repository';
import { CreateNotificationInput } from '@libs/data-access/dtos/input/create-notification.input';
// Direct import for other repositories to avoid barrel circularity
import { UserTokenMetaRepository } from '@libs/data-access/repositories/user-token-meta.repository';
import { UserDetailsRepository } from '@libs/data-access/repositories/user-detail.repository';

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
    // Maps NotificationType to the corresponding notification settings field name
    // If a notification type is not in this map, the check is skipped (always sent)
    private readonly NOTIFICATION_TYPE_SETTING_MAP: Record<string, string> = {
        // Payment/earning related
        [NotificationType.PAYMENT_RECEIPT]: 'earnings',
        [NotificationType.PAYMENT_FAILURE]: 'earnings',
        [NotificationType.PAYMENT_WITHDRAWAL]: 'earnings',
        [NotificationType.WALLET_TOPUP]: 'earnings',
        [NotificationType.WALLET_TOPUP_FAILED]: 'earnings',
        [NotificationType.PAYMENT_CONFIRM]: 'earnings',
        [NotificationType.PROCEED_PAYMENT]: 'earnings',
        [NotificationType.REQUEST_TO_PAY]: 'earnings',
        // Promotions
        [NotificationType.PROMOCODE_PROMOTION]: 'offersAndPromotion',
        // Ride updates
        [NotificationType.RIDE_REQUEST]: 'ridesUpdate',
        [NotificationType.RIDE_CANCELLATION]: 'ridesUpdate',
        [NotificationType.RIDE_ACCEPTED]: 'ridesUpdate',
        [NotificationType.RIDE_START]: 'ridesUpdate',
        [NotificationType.RIDE_END]: 'ridesUpdate',
        [NotificationType.RIDE_DETAILS]: 'ridesUpdate',
        [NotificationType.DRIVER_ON_THE_WAY]: 'ridesUpdate',
        [NotificationType.SCHEDULED_RIDE_NOTIFY]: 'ridesUpdate',
        [NotificationType.RIDE_COMPLETE_NOTIFICATION]: 'ridesUpdate',
        [NotificationType.REAL_TIME_RIDE_TRACKING]: 'ridesUpdate',
        // App updates
        [NotificationType.TERMS_AND_CONDITIONS_UPDATED]: 'appUpdates',
    };

    constructor(
        @Inject(forwardRef(() => NotificationRepository))
        private readonly notificationRepository: NotificationRepository,
        private readonly firebaseMessagingService: FirebaseMessagingService,
        @Inject(forwardRef(() => UserTokenMetaRepository))
        private readonly userTokenRepository: UserTokenMetaRepository,
        private readonly userDetailsRepository: UserDetailsRepository,
        @InjectConnection() private readonly connection: Connection,
    ) { }

    /**
     * Checks whether the user has the given notification type enabled in their settings.
     * Returns true if:
     *   - The notification type has no mapped setting (always send)
     *   - The user's role has no settings defined (default to send)
     *   - The specific setting key doesn't exist for the role (default to send)
     *   - The setting is explicitly enabled
     * Returns false only if the setting key exists and is explicitly disabled.
     */
    private async shouldSendNotification(
        userId: Types.ObjectId,
        loginAs: string,
        notificationType: NotificationType,
    ): Promise<boolean> {
        const settingKey = this.NOTIFICATION_TYPE_SETTING_MAP[notificationType];
        // No mapping for this type → always send
        if (!settingKey) return true;

        try {
            const userDetails = await this.userDetailsRepository.findOne({ userId });
            if (!userDetails?.notificationSettings) return true;

            const roleSettings = userDetails.notificationSettings?.[loginAs];
            // No settings for this role → always send
            if (!roleSettings) return true;

            // Setting key doesn't exist in role's settings → always send
            if (roleSettings[settingKey] === undefined) return true;

            return roleSettings[settingKey] === true;
        } catch {
            // If we can't fetch settings, default to sending
            return true;
        }
    }

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

        // Check if user has this notification type enabled in their settings
        const shouldSend = await this.shouldSendNotification(userId, user.loginAs, notificationPayload.notificationType);
        if (!shouldSend) {
            console.log(`Notification type ${notificationPayload.notificationType} is disabled for user ${userId} (role: ${user.loginAs}), skipping push`);
            return notification;
        }

        const token = await this.userTokenRepository.findOne({ userId: userId, grant: TokenGrantType.REFRESH_TOKEN });
                console.log("========firebase token=====", token?.firebaseToken)
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
                firebaseData.rideId = String(payload.rideId);
            }
            if (payload.noOfPassengers) {
                firebaseData.noOfPassengers = String(payload.noOfPassengers);
            }
            if (payload.rideType) {
                firebaseData.rideType = String(payload.rideType);
            }

            if (payload.rideStatus) {
                firebaseData.rideStatus = String(payload.rideStatus);
            }
            if (payload.actualTimeInMinutes) {
                firebaseData.actualTimeInMinutes = String(payload.actualTimeInMinutes);
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
                firebaseData.passengerId = String(payload.passengerId);
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
                firebaseData.passengerName = String(payload.passengerName);
            }
            if (payload.passengerPhone) {
                firebaseData.passengerPhone = String(payload.passengerPhone);
            }
            if (payload.passengerGender) {
                firebaseData.passengerGender = String(payload.passengerGender);
            }
            if (payload.passengerProfileImages && Array.isArray(payload.passengerProfileImages) && payload.passengerProfileImages.length > 0) {
                firebaseData.passengerProfileImages = JSON.stringify(payload.passengerProfileImages);
            }
            // Include driver info fields
            if (payload.driverName) {
                firebaseData.driverName = String(payload.driverName);
            }
            if (payload.driverPhone) {
                firebaseData.driverPhone = String(payload.driverPhone);
            }
            if (payload.driverProfileImage) {
                firebaseData.driverProfileImage = String(payload.driverProfileImage);
            }
            if (payload.driverRating !== undefined && payload.driverRating !== null) {
                firebaseData.driverRating = String(payload.driverRating);
            }
            // Include vehicle info fields
            if (payload.vehicleType) {
                firebaseData.vehicleType = String(payload.vehicleType);
            }
            if (payload.vehicleModel) {
                firebaseData.vehicleModel = String(payload.vehicleModel);
            }
            if (payload.vehicleColor) {
                firebaseData.vehicleColor = String(payload.vehicleColor);
            }
            if (payload.vehicleNumberPlate) {
                firebaseData.vehicleNumberPlate = String(payload.vehicleNumberPlate);
            }
            // Include passenger/driver snapshot fields
            if (payload.passengerSnapshot) {
                firebaseData.passenger = JSON.stringify(payload.passengerSnapshot);
            }
            if (payload.driverSnapshot) {
                firebaseData.driver = JSON.stringify(payload.driverSnapshot);
            }
             if (payload.cancelled) {
                firebaseData.cancelled =String(payload.cancelled);
            }
              if (payload.rideUUId) {
                firebaseData.rideUUId = String(payload.rideUUId);
            }
            console.log("payload", payload)
            // Silent push: data-only message with no `notification` block and no sound,
            // so the OS does not display anything and the app handles the payload
            // in the background. Used for instant ride requests to drivers.
            if ((payload as any).silent === true) {
                try {
                    await this.firebaseMessagingService.sendSingleMessage(token.firebaseToken, {
                        token: token.firebaseToken,

                        // NOTE: no `notification` block — data-only = silent delivery
                        data: firebaseData,

                        android: {
                            priority: 'high',
                        },

                        apns: {
                            headers: {
                                'apns-priority': '5',
                            },
                            payload: {
                                aps: {
                                    // content-available triggers background wake-up on iOS
                                    // without showing a banner or playing a sound.
                                    'content-available': 1,
                                },
                            },
                        },
                    });
                } catch (e) {
                    console.log("============NOTIFIICATION ERROR", e)
                }
                return notification;
            }
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

                    // Check settings before sending the additional promo push notification
                    const shouldSend = await this.shouldSendNotification(
                        new Types.ObjectId(userId),
                        roles.USER,
                        NotificationType.PROMOCODE_PROMOTION,
                    );
                    if (!shouldSend) {
                        return;
                    }

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
