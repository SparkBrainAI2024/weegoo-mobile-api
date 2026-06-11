import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
export class DriverMatchFoundEvent {
  @Field()
  rideId: string;

  @Field()
  rideUUId: string;

  @Field()
  passengerId: string;

  @Field({ nullable: true })
  driverId?: string;

  @Field({ nullable: true })
  driverName?: string;

  @Field({ nullable: true })
  driverImage?: string;

  @Field(() => Float, { nullable: true })
  rating?: number;

  @Field({ nullable: true })
  vehicleType?: string;

  @Field({ nullable: true })
  vehicleModel?: string;

  @Field({ nullable: true })
  color?: string;

  @Field({ nullable: true })
  numberPlate?: string;

  @Field(() => Float, { nullable: true })
  estimatedFare?: number;

  @Field(() => Float, { nullable: true })
  estimatedTimeInMinutes?: number;

  @Field(() => Float, { nullable: true })
  distanceInKm?: number;

  @Field(() => Float, { nullable: true })
  distanceToPickupKm?: number;

  @Field()
  attemptNumber: number;

  @Field()
  status: string; // 'waiting_for_response' | 'accepted' | 'rejected' | 'timeout' | 'match_failed'

  @Field({ nullable: true })
  message?: string;

  @Field()
  timestamp: string;
}