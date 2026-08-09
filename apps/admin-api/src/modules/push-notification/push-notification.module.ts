import { Module } from "@nestjs/common";
import { PushNotificationModule as PushNotificationServiceModule } from "@libs/services/push-notification/push-notification.module";
import { AdminAuthModule } from "../auth/auth.module";
import { PushNotificationResolver } from "./resolver/push-notification.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
@Module({
  imports: [PushNotificationServiceModule, AdminAuthModule, UserPersistenceModule],
  providers: [PushNotificationResolver,EnvService],
})
export class AdminPushNotificationModule {}