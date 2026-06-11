import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Occasion, OccasionSchema, PromoCode, PromoCodeSchema } from '@libs/data-access';
import { PromoCodeRepository } from '@libs/data-access/repositories/promo-code.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PromoCode.name, schema: PromoCodeSchema },
       { name: Occasion.name, schema: OccasionSchema },
    ]),
  ],
  providers: [PromoCodeRepository],
  exports: [PromoCodeRepository],
})
export class PromoCodePersistenceModule {}