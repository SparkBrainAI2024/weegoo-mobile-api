import { Module } from '@nestjs/common';
import { KhaltiService } from './khalti.service';
import { EnvService } from '@libs/common/config/env.service';

@Module({
  providers: [KhaltiService, EnvService],
  exports: [KhaltiService],
})
export class KhaltiModule {}