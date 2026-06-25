import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { PromoCodePersistenceModule } from "@libs/services/promocode/src/promocode.persistence.module";
import { PromoCodeResolver } from "@libs/services/promocode/src/promocode.resolver";
import { PromoCodeService } from "@libs/services/promocode/src/promocode.service";
import { AdminAuthModule } from "../auth/auth.module";
import { MongooseModule } from "@nestjs/mongoose";
import { Occasion, OccasionSchema } from "@libs/data-access";

@Module({
  imports: [
    PromoCodePersistenceModule,
    UserPersistenceModule,
    AdminAuthModule,
    MongooseModule.forFeature([
      { name: Occasion.name, schema: OccasionSchema },
    ]),
  ],
  providers: [
    PromoCodeService,
    PromoCodeResolver,
    NotificationService,
    FirebaseMessagingService,
    EnvService,
  ],
  exports: [PromoCodeService],
})
export class PromoCodeModule {}
