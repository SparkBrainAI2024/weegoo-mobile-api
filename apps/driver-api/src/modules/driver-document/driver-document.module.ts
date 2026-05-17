import { Module } from '@nestjs/common';
import { DriverDocumentService } from './driver-document.service';
import { DriverDocumentResolver } from './resolver/driver-document.resolver';
import { DriverDocumentRepository } from '@libs/data-access/repositories/driver-document.repository';
import { S3Module } from '@libs/s3/s3.module';
import { MongooseModule } from '@nestjs/mongoose';
import { DriverDocument, DriverDocumentSchema } from '@libs/data-access/entities/driver-document.entity';
import { UserPersistenceModule } from '@libs/services/user/user-persistent.module';
import { EnvService } from '@libs/common/config/env.service';

@Module({
  imports:   [S3Module,MongooseModule.forFeature([{ name: DriverDocument.name, schema: DriverDocumentSchema }]),UserPersistenceModule],
  providers: [DriverDocumentResolver, DriverDocumentService, DriverDocumentRepository, EnvService],
   exports:   [DriverDocumentService, DriverDocumentRepository],
})
export class DriverDocumentModule {}
