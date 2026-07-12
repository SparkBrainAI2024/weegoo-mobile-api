import { Module } from "@nestjs/common";
import { NotificationPersistentModule } from "./notification-persistent.module";
import { NotificationService } from "./notification.service";
import { NotificationResolver } from "./resolver/notification.resolver";
// Import FirebaseMessagingService - adjust the path if it is located elsewhere
import { FirebaseMessagingService } from "@libs/services/firebase-messaging";
import { ConfigModule } from "@nestjs/config";

@Module({
    imports: [
        NotificationPersistentModule,
        ConfigModule,
    ],
    providers: [ 
        FirebaseMessagingService, 
        NotificationService, 
        NotificationResolver
    ]
})
export class NotificationModule { }
