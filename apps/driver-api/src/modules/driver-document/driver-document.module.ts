import { Module } from '@nestjs/common';
import { DriverDocumentService } from './driver-document.service';
import { DriverDocumentResolver } from './driver-document.resolver';

@Module({
  providers: [DriverDocumentResolver, DriverDocumentService],
   exports:   [DriverDocumentService],
})
export class DriverDocumentModule {}
