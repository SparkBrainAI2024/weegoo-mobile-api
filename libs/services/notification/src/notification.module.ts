import { Module } from "@nestjs/common";
import { NotificationPersistentModule } from "./notification-persistent.module";
import { NotificationService } from "./notification.service";
import { NotificationResolver } from "./resolver/notification.resolver";
// Import FirebaseMessagingService - adjust the path if it is located elsewhere
import { FirebaseMessagingService } from "@libs/services/firebase-messaging";
import { ConfigModule } from "@nestjs/config";
import { EnvService } from "@libs/common/config/env.service";
import { userModel } from "@libs/data-access";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
  imports: [
    MongooseModule.forFeature([userModel]),
    NotificationPersistentModule,
    ConfigModule,
  ],
  providers: [
    FirebaseMessagingService,
    NotificationService,
    NotificationResolver,
    EnvService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
