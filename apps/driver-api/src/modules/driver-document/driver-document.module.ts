import { Module } from '@nestjs/common';
import { DriverDocumentService } from './driver-document.service';
import { DriverDocumentResolver } from './resolver/driver-document.resolver';

@Module({
  providers: [DriverDocumentResolver, DriverDocumentService],
   exports:   [DriverDocumentService],
})
export class DriverDocumentModule {}
