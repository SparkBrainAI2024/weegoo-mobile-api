import { Device, DeviceRepository, DeviceSchema, User, UserDetails, UserDetailsRepository, UserDetailsSchema, UserRepository, UserSchema, UserVerification, UserVerificationRepository, UserVerificationSchema, UserTokenMeta, UserTokenMetaSchema, UserTokenMetaRepository, UserDailyOnlineStatus, UserDailyOnlineStatusSchema, UserDailyOnlineStatusRepository } from "@libs/data-access";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserVerification.name, schema: UserVerificationSchema },
      { name: UserDetails.name, schema: UserDetailsSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: UserTokenMeta.name, schema: UserTokenMetaSchema },
      { name: UserDailyOnlineStatus.name, schema: UserDailyOnlineStatusSchema },
    ]),
  ],
  providers: [
    UserRepository,
    UserVerificationRepository,
    DeviceRepository,
    UserDetailsRepository,
    UserTokenMetaRepository,
    UserDailyOnlineStatusRepository,
  ],
  exports: [
    MongooseModule,
    UserRepository,
    UserVerificationRepository,
    DeviceRepository,
    UserDetailsRepository,
    UserTokenMetaRepository,
    UserDailyOnlineStatusRepository,
  ],
})
export class UserPersistenceModule {}