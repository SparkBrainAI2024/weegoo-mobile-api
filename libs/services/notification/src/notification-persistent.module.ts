import { NotificationSchema, Notification } from '@libs/data-access/entities/notification.entity';
import { User, UserSchema } from '@libs/data-access/entities/user.entity';
import { UserTokenMeta, UserTokenMetaSchema } from '@libs/data-access/entities/user-token-meta.entity';
import { NotificationRepository } from '@libs/data-access/repositories/notification.repository';
import { UserTokenMetaRepository } from '@libs/data-access/repositories/user-token-meta.repository';
import { FirebaseMessagingService } from "@libs/services/firebase-messaging";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Notification.name, schema: NotificationSchema },
            { name: User.name, schema: UserSchema },
            { name: UserTokenMeta.name, schema:UserTokenMetaSchema  },
        ]),
    ],
    providers: [
        NotificationRepository,
        UserTokenMetaRepository

    ],
    exports: [
        NotificationRepository,
        UserTokenMetaRepository
    ],
})
export class NotificationPersistentModule { }