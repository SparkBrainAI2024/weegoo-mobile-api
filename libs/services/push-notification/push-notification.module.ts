import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FirebaseMessagingService } from "@libs/services/firebase-messaging";
import { EnvService } from "@libs/common/config/env.service";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { PushNotificationService } from "./push-notification.service";

@Module({
  imports: [ConfigModule, UserPersistenceModule],
  providers: [FirebaseMessagingService, EnvService, PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}