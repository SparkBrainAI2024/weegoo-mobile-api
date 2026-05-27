import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';

import { ErrorException, toMongoId } from '@libs/common';
import { Favourites, FavouritesDocument } from '../entities/favourites.entity';
import { PaginationInputOnly } from '../base/base.input';
import { FavouriteListWithPaginationResponse } from '../dtos/response/favourites-with-pagination.response';
import { NotificationDocument } from '../entities/notification.entity';

@Injectable()
export class NotificationRepository extends BaseRepository<NotificationDocument> {
  constructor(@InjectModel(Notification.name) private readonly _model: BaseModel<NotificationDocument>) {
    super(_model);
  }
   
  createNotificationWithPushNotifcation(notificationData: Partial<NotificationDocument>): Promise<NotificationDocument> {
    try {
      const notification = this._model.create(notificationData);
      return notification;
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
