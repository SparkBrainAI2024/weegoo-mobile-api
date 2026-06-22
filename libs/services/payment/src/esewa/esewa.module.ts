import { Module } from '@nestjs/common';
import { EsewaService } from './esewa.service';
import { EnvService } from '@libs/common/config/env.service';

@Module({
  providers: [EsewaService, EnvService],
  exports: [EsewaService],
})
export class EsewaModule {}