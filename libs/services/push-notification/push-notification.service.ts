import { Injectable } from "@nestjs/common";
import { FirebaseMessagingService } from "@libs/services/firebase-messaging";
import { UserTokenMetaRepository } from "@libs/data-access/repositories/user-token-meta.repository";
import { roles } from "@libs/data-access/enums/user.enum";
import {
  PushNotificationTarget,
  SendPushNotificationInput,
} from "@libs/data-access/dtos/input/send-push-notification.input";

@Injectable()
export class PushNotificationService {
  constructor(
    private readonly firebaseMessagingService: FirebaseMessagingService,
    private readonly userTokenMetaRepository: UserTokenMetaRepository,
  ) {}

  async sendPushNotification(
    input: SendPushNotificationInput,
  ): Promise<{ success: boolean; notifiedCount: number }> {
    const targetRoles = this.getTargetRoles(input.target);

    const tokens = await this.userTokenMetaRepository.findFirebaseTokensByRoles(
      targetRoles,
    );

    if (tokens.length === 0) {
      return { success: true, notifiedCount: 0 };
    }

    const response = await this.firebaseMessagingService.sendMulticastMessage(
      tokens,
      {
        notification: {
          title: input.title,
          body: input.message,
        },
        data: {
          title: input.title,
          body: input.message,
          notificationType: "ADMIN_PUSH_NOTIFICATION",
        },
        android: {
          priority: "high",
          notification: {
            priority: "high",
            sound: "default",
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      } as any,
    );

    return {
      success: true,
      notifiedCount: response.successCount,
    };
  }

  private getTargetRoles(target: PushNotificationTarget): string[] {
    switch (target) {
      case PushNotificationTarget.USER:
        return [roles.USER];
      case PushNotificationTarget.DRIVER:
        return [roles.RIDER];
      case PushNotificationTarget.ALL:
        return [roles.USER, roles.RIDER];
      default:
        return [roles.USER, roles.RIDER];
    }
  }
}