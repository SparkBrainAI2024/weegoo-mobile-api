import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { NotificationService } from "@libs/services/notification/notification.service";
import { NotificationResolver } from "@libs/services/notification/resolver/notification.resolver";
import { FirebaseMessagingService } from "@libs/services/firebase-messaging";
import { NotificationPersistentModule } from "@libs/services/notification/notification-persistent.module";

@Module({
    imports: [
        NotificationPersistentModule, UserPersistenceModule
    ],
    providers: [
        NotificationService,
        FirebaseMessagingService,
        EnvService,
        NotificationResolver
    ],
    exports: [NotificationService]
})
export class NotificationModule { }