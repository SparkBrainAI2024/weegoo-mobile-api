import { Module } from "@nestjs/common";
import { NotificationPersistentModule } from "./notification-persistent.module";
import { NotificationService } from "./notification.service";
import { NotificationResolver } from "./resolver/notification.resolver";
// Import FirebaseMessagingService - adjust the path if it is located elsewhere
import { FirebaseMessagingService } from "@libs/services/firebase-messaging";
import { ConfigModule } from "@nestjs/config";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";

@Module({
    imports: [
        NotificationPersistentModule,
        ConfigModule,
        UserPersistenceModule
    ],
    providers: [ 
        FirebaseMessagingService, 
        EnvService,
        NotificationService, 
        NotificationResolver
    ],
    exports: [NotificationService]
})
export class NotificationModule { }
