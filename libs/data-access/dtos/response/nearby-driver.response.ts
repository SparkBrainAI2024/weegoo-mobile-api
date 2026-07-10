import { Field, ObjectType, Float } from '@nestjs/graphql';

@ObjectType()
export class NearbyDriverResponse {
  @Field(() => String)
  driverId: string;

  @Field(() => String, { nullable: true })
  driverName?: string;

  @Field(() => String, { nullable: true })
  profileImage?: string;

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;

  @Field(() => Float, { nullable: true })
  rating?: number;

  @Field(() => Float, { nullable: true })
  distanceInKm?: number;

  @Field(() => String, { nullable: true })
  vehicleType?: string;

  @Field(() => String, { nullable: true })
  vehicleModel?: string;

  @Field(() => String, { nullable: true })
  color?: string;

  @Field(() => String, { nullable: true })
  numberPlate?: string;
}

@ObjectType()
export class NearbyDriversSubscriptionResponse {
  @Field(() => String)
  passengerId: string;

  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;

  @Field(() => [NearbyDriverResponse])
  drivers: NearbyDriverResponse[];
}