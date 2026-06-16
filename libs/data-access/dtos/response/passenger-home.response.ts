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
  name: string;

  @Field(() => Float)
  amount: number;

  @Field(() => Date)
  expiryTime: Date;

  @Field(() => Date)
  offerAvailableTime: Date;

  @Field(() => String)
  promocodeType: string; // 'PERCENTAGE' or 'FLAT'

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
