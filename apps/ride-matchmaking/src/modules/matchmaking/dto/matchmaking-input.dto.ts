import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Weather conditions that affect pricing and vehicle suggestions.
 */
export enum WeatherConditionEnum {
  NONE = 'none',
  LIGHT = 'light',
  MODERATE = 'moderate',
  HEAVY = 'heavy',
}

/**
 * Traffic conditions that affect pricing.
 */
export enum TrafficConditionEnum {
  LOW = 'low',
  MODERATE = 'moderate',
  HEAVY = 'heavy',
  SEVERE = 'severe',
}

/**
 * Driver's action in response to a ride request.
 */
export enum DriverActionEnum {
  ACCEPT = 'accept',
  REJECT = 'reject',
}

registerEnumType(WeatherConditionEnum, {
  name: 'WeatherCondition',
  description: 'Weather conditions affecting ride pricing and safety suggestions',
});

registerEnumType(TrafficConditionEnum, {
  name: 'TrafficCondition',
  description: 'Traffic conditions affecting ride pricing',
});

registerEnumType(DriverActionEnum, {
  name: 'DriverAction',
  description: 'Driver response to a ride request',
});

/**
 * Input for triggering a matchmaking process.
 */
@InputType()
export class MatchDriversInput {
  @Field(() => String)
  @IsString()
  rideId: string;

  @Field(() => WeatherConditionEnum, { nullable: true, defaultValue: WeatherConditionEnum.NONE })
  @IsOptional()
  @IsEnum(WeatherConditionEnum)
  weather?: WeatherConditionEnum;

  @Field(() => TrafficConditionEnum, { nullable: true, defaultValue: TrafficConditionEnum.LOW })
  @IsOptional()
  @IsEnum(TrafficConditionEnum)
  traffic?: TrafficConditionEnum;
}

/**
 * Input for a driver's response to a ride request.
 */
@InputType()
export class DriverResponseInput {
  @Field(() => String)
  @IsString()
  rideId: string;

  @Field(() => String)
  @IsString()
  driverId: string;

  @Field(() => DriverActionEnum)
  @IsEnum(DriverActionEnum)
  action: DriverActionEnum;
}

/**
 * Input for fetching estimated fare.
 */
@InputType()
export class EstimatedFareInput {
  @Field(() => String)
  @IsString()
  rideId: string;

  @Field(() => WeatherConditionEnum, { nullable: true })
  @IsOptional()
  @IsEnum(WeatherConditionEnum)
  weather?: WeatherConditionEnum;

  @Field(() => TrafficConditionEnum, { nullable: true })
  @IsOptional()
  @IsEnum(TrafficConditionEnum)
  traffic?: TrafficConditionEnum;
}