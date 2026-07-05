import { Module } from "@nestjs/common";
import { DriverDocumentResolver } from "./resolver/driver-document.resolver";
import { DriverDocumentRepository } from "@libs/data-access/repositories/driver-document.repository";
import { S3Module } from "@libs/s3/s3.module";
import { MongooseModule } from "@nestjs/mongoose";
import {
  DriverDocument,
  DriverDocumentSchema,
} from "@libs/data-access/entities/driver-document.entity";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { CommonDriverDocumentModule } from "@libs/services/driver-document/driver-document.module";
import { User, UserSchema } from "@libs/data-access";
import { UserAuthModule } from "@libs/services/auth/auth.module";

@Module({
  imports: [
    UserAuthModule,
    UserPersistenceModule,
    MongooseModule.forFeature([
      { name: DriverDocument.name, schema: DriverDocumentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CommonDriverDocumentModule,
  ],
  providers: [DriverDocumentResolver, DriverDocumentRepository, EnvService],
  exports: [DriverDocumentRepository],
})
export class DriverDocumentModule {}
