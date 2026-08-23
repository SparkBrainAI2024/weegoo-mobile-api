import { DiscountTypeEnum } from '@libs/data-access/enums/promo-code.enum';
import { ScheduledVehicleType } from '@libs/data-access/enums/vehicle.enum';
import { Field, ObjectType, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class PassengerLocationResponse {
  @Field(() => String, { nullable: true })
  address?: string;

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;
}

@ObjectType()
export class PassengerPromoCodeResponse {
  @Field(() => String)
  promocodeId: string;

  @Field(() => Float)
  amount: number;
  @Field(() => String)
  name: string;

  @Field(() => Number, { defaultValue: 0 })
  promocodeUserLimit: number;

  @Field(() => Date)
  expiryTime: Date;

  @Field(() => Date)
  offerAvailableTime: Date;

  @Field(() => DiscountTypeEnum)
  promocodeType: DiscountTypeEnum; // 'PERCENTAGE' or 'FLAT'

  @Field(() => Float, { nullable: true })
  discountPercentage?: number;
}

@ObjectType()
export class BasicVehicleEstimateResponse {
  @Field(() => String)
  vehicleType: string;

  @Field(() => Float)
  estimatedFare: number;

  @Field(() => String)
  comfortType: string;

  @Field(() => Boolean, { nullable: true })
  hasAC?: boolean;
}

@ObjectType()
export class PassengerHomeResponse {
  @Field(() => PassengerLocationResponse, { nullable: true })
  homeLocation?: PassengerLocationResponse;

  @Field(() => PassengerLocationResponse, { nullable: true })
  workLocation?: PassengerLocationResponse;

  @Field(() => PassengerPromoCodeResponse, { nullable: true })
  promoCode?: PassengerPromoCodeResponse;

  @Field(() => [BasicVehicleEstimateResponse])
  vehicleEstimates: BasicVehicleEstimateResponse[];
}

/**
 * A single vehicle type available for scheduled rides.
 * Returns only the scheduled vehicle types (JEEP, MICRO, CAR) using the
 * separate ScheduledVehicleType enum.
 */
@ObjectType()
export class ScheduleVehicleTypeResponse {
  @Field(() => ScheduledVehicleType, {
    description: "The scheduled vehicle type enum value (JEEP, MICRO, or CAR).",
  })
  vehicleType: ScheduledVehicleType;

  @Field(() => String, {
    description: "Human-readable label for the vehicle type.",
  })
  label: string;
}
