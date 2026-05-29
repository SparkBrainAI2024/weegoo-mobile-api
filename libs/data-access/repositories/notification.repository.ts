import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';
import { ErrorException, toMongoId } from '@libs/common';
import { CursorPaginationInput } from '../base/base.input';
import { NotificationListWithCursorPaginationResponse } from '../dtos/response/notification-listing-with-curson-pagination.response';
import { NotificationDocument, Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationRepository extends BaseRepository<NotificationDocument> {
  constructor(@InjectModel(Notification.name) private readonly _model: BaseModel<NotificationDocument>) {
    super(_model);
  }

  createNotification(notificationData: Partial<NotificationDocument>): Promise<NotificationDocument> {
    try {
      const notification = this._model.create(notificationData);
      return notification;
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  setNotificationAsRead(notificationId: string, userId: string): Promise<NotificationDocument> {
    try {
      return this.findOneAndUpdate(
        { _id: toMongoId(notificationId), userId: toMongoId(userId) },
        { readAt: new Date() },
        { new: true }
      );
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  setNotificationOpen( userId: string): Promise<NotificationDocument> {
    try {
      return this.findOneAndUpdate(
        { userId: toMongoId(userId) },
        { isOpen: true, viewedAt: new Date() },
        { new: true }
      );
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  countUnreadAndUnopenedNotifications(userId: string): Promise<number> {
    try {
      return this.count({ userId: toMongoId(userId), readAt: null, isOpen: false, deleted: false });
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getNotificationsByUserId(userId: string, pagination: CursorPaginationInput): Promise<NotificationListWithCursorPaginationResponse> {
    try {
      const filter = { userId: toMongoId(userId), deleted: false };
      const { data, nextCursor, hasNextPage } = await this.cursorPaginate(filter, pagination);
      console.log("data",data)
      return {
        data: data as any,
        pageInfo: {
          nextCursor: nextCursor ?? undefined,
          hasNextPage,
        },
      } as NotificationListWithCursorPaginationResponse;
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}