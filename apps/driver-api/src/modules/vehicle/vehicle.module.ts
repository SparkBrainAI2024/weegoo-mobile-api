import { Module } from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { VehicleResolver } from './resolver/vehicle.resolver';
import { VehicleRepository } from '../../../../../libs/data-access/repositories/vehicle.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from '@libs/common/config/env.service';
import { Vehicle, VehicleSchema } from '@libs/data-access/entities/vehicle.entity';


@Module({
  imports: [MongooseModule.forFeature([
  { name: Vehicle.name, schema: VehicleSchema },
]),UserPersistenceModule],
  providers: [VehicleResolver, VehicleService, VehicleRepository, EnvService],
  exports: [VehicleService],
})
export class VehicleModule {}
