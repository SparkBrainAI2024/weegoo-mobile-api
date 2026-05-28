import { Module } from "@nestjs/common";
import { NotificationPersistentModule } from "./notification-persistent.module";
import { NotificationService } from "./notification.service";
import { NotificationResolver } from "./resolver/notification.resolver";
// Import FirebaseMessagingService - adjust the path if it is located elsewhere
import { FirebaseMessagingService } from "@libs/services/firebase-messaging";

// Use direct imports instead of the @libs/data-access barrel to avoid circular dependency "undefined" issues

@Module({
    imports: [NotificationPersistentModule],
    providers: [ 
        FirebaseMessagingService, 
        NotificationService, 
        NotificationResolver
    ]
})
export class NotificationModule { }