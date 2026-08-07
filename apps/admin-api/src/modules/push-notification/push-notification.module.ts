import { Module } from "@nestjs/common";
import { PushNotificationModule as PushNotificationServiceModule } from "@libs/services/push-notification/push-notification.module";
import { AdminAuthModule } from "../auth/auth.module";
import { PushNotificationResolver } from "./resolver/push-notification.resolver";

@Module({
  imports: [PushNotificationServiceModule, AdminAuthModule],
  providers: [PushNotificationResolver],
})
export class AdminPushNotificationModule {}