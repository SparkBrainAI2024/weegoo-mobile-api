import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { PromoCodePersistenceModule } from "@libs/services/promocode/src/promocode.persistence.module";
import { PromoCodeResolver } from "@libs/services/promocode/src/promocode.resolver";
import { PromoCodeService } from "@libs/services/promocode/src/promocode.service";
import { AdminAuthModule } from "../auth/auth.module";
import { NotificationPersistentModule, NotificationService } from "@libs/services/notification";
import { FirebaseMessagingService } from "@libs/services/firebase-messaging";

@Module({
    imports: [
       PromoCodePersistenceModule,
       UserPersistenceModule,
       AdminAuthModule,
       NotificationPersistentModule
    ],
    providers: [
        PromoCodeService,
        PromoCodeResolver,
        NotificationService,
        FirebaseMessagingService,
        EnvService
    ],
    exports: [PromoCodeService]
})
export class PromoCodeModule { }
