import { User } from '@libs/data-access/entities/user.entity';
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
import { TokenGrantType } from '@libs/data-access';

@Injectable()
export class NotificationService {
    constructor(
        @Inject(forwardRef(() => NotificationRepository))
        private readonly notificationRepository: NotificationRepository,
        private readonly firebaseMessagingService: FirebaseMessagingService,
        @Inject(forwardRef(() => UserTokenMetaRepository))
        private readonly userTokenRepository: UserTokenMetaRepository
    ) { }

    /**
      * Retrieves a paginated list of notification rides for a given user. The method accepts the user object and pagination options, and returns a paginated response containing the user's favourite rides. The pagination options can include page number, limit, sorting, and filtering criteria to customize the results.
      * @param user - The user for whom to retrieve favourite rides
      * @param options - Pagination and filtering options
      * @returns A paginated list of the user's favourite rides
     */
    async findNotificationWithListingAndGrouping(
        user: User,
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
    async createNotification(notificationPayload: CreateNotificationInput, user: User): Promise<Notification> {
        const roles = user.loginAs;
        const userId = user._id;
        const newNotificationPayload = { ...notificationPayload, roles, userId };
        const notification = await this.notificationRepository.create({ ...newNotificationPayload as any });
        const token = await this.userTokenRepository.findOne({ userId: userId, grant:TokenGrantType.REFRESH_TOKEN }, null, null, { sort: { createdAt: -1 } });
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
            await this.firebaseMessagingService.sendSingleMessage(token.firebaseToken, {
                data: firebaseData,
                token: token.firebaseToken,
                notification: {
                    title: notification.title,
                    body: notification.description,
                }
            });
        }
        console.log("firebase token",token?.firebaseToken)
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

}
