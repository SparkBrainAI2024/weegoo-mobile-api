import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rides, RidesSchema } from '@libs/data-access/entities/rides.entity';
import { User, UserSchema } from '@libs/data-access/entities/user.entity';
import { Vehicle, VehicleSchema } from '@libs/data-access/entities/vehicle.entity';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingResolver } from './matchmaking.resolver';
import { DistanceCalculatorService } from './services/distance-calculator.service';
import { DynamicPricingService } from './services/dynamic-pricing.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rides.name, schema: RidesSchema },
      { name: User.name, schema: UserSchema },
      { name: Vehicle.name, schema: VehicleSchema },
    ]),
  ],
  providers: [
    MatchmakingResolver,
    MatchmakingService,
    DistanceCalculatorService,
    DynamicPricingService,
  ],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}