import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { SendPushNotificationInput } from "@libs/data-access/dtos/input/send-push-notification.input";
import { SendPushNotificationResponse } from "@libs/data-access/dtos/response/send-push-notification.response";
import { PushNotificationService } from "@libs/services/push-notification/push-notification.service";

@UseGuards(AdminAuthGuard)
@Resolver()
export class PushNotificationResolver {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Mutation(() => SendPushNotificationResponse)
  async sendPushNotification(
    @Args("input") input: SendPushNotificationInput,
  ): Promise<SendPushNotificationResponse> {
    return this.pushNotificationService.sendPushNotification(input);
  }
}