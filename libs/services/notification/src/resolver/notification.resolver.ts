import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import { Notification } from '@libs/data-access/entities/notification.entity';
import { User } from '@libs/data-access/entities/user.entity';
import { CursorPaginationInput } from '@libs/data-access/base/base.input';
import { NotificationListWithCursorPaginationResponse } from '@libs/data-access/dtos/response/notification-listing-with-curson-pagination.response';
import { CreateNotificationInput } from '@libs/data-access/dtos/input/create-notification.input';
import { CurrentUser } from '@libs/common'; 
import { AuthGuard } from '@libs/guards';

@Resolver(() => Notification)
@UseGuards(AuthGuard)
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) {}

  @Query(() => NotificationListWithCursorPaginationResponse, { name: 'getNotifications' })
  async getNotifications(
    @CurrentUser() user: User,
    @Args('options') options: CursorPaginationInput,
  ) {
    return this.notificationService.findNotificationWithListingAndGrouping(user, options);
  }

  @Query(() => Int, { name: 'unreadNotificationCount' })
  async unreadNotificationCount(@CurrentUser() user: User) {
    return this.notificationService.countUnreadAndUnopenedNotifications(user._id.toString());
  }

  @Mutation(() => Notification, { name: 'readNotification' })
  async readNotification(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ) {
    await this.notificationService.validateNotificationOwnership(id, user._id.toString());
    return this.notificationService.setNotificationAsRead(id, user._id.toString());
  }

  @Mutation(() => Notification, { name: 'openNotifications' })
  async openNotifications(@CurrentUser() user: User) {
    return this.notificationService.setNotificationOpen(user._id.toString());
  }

  @Mutation(() => Notification, { name: 'createNotification' })
  async createNotification(
    @Args('notificationPayload') notificationPayload: CreateNotificationInput, 
    @CurrentUser() user: User,
  ) {
    return this.notificationService.createNotification(notificationPayload, user);
  }
}
