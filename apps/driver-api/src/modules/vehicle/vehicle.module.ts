import { Module } from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { VehicleResolver } from './vehicle.resolver';
import { VehicleRepository } from './repository/vehicle.repository';
import { Vehicle, VehicleSchema } from './entities/vehicle.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from '@libs/common/config/env.service';


@Module({
  imports: [MongooseModule.forFeature([
  { name: Vehicle.name, schema: VehicleSchema },
]),UserPersistenceModule],
  providers: [VehicleResolver, VehicleService, VehicleRepository, EnvService],
  exports: [VehicleService],
})
export class VehicleModule {}
