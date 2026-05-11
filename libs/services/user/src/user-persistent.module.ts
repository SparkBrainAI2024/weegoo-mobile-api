import { Device, DeviceRepository, DeviceSchema, User, UserDetails, UserDetailsRepository, UserDetailsSchema, UserRepository, UserSchema, UserVerification, UserVerificationRepository, UserVerificationSchema, UserTokenMeta, UserTokenMetaSchema, UserTokenMetaRepository } from "@libs/data-access";
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
    ]),
  ],
  providers: [
    UserRepository,
    UserVerificationRepository,
    DeviceRepository,
    UserDetailsRepository,
    UserTokenMetaRepository,
  ],
  exports: [
    MongooseModule,
    UserRepository,
    UserVerificationRepository,
    DeviceRepository,
    UserDetailsRepository,
    UserTokenMetaRepository,
  ],
})
export class UserPersistenceModule {}