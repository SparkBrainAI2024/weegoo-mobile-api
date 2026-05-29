import { Field, InputType, registerEnumType, Int } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsDateString, Min } from 'class-validator';

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
 * Rain forecast conditions for scheduled pricing.
 */
export enum RainConditionEnum {
  NONE = 'none',
  LIGHT = 'light',
  HEAVY = 'heavy',
}

/**
 * Historical traffic conditions for scheduled pricing.
 */
export enum HistoricalTrafficEnum {
  LOW = 'low',
  MODERATE = 'moderate',
  HEAVY = 'heavy',
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

registerEnumType(RainConditionEnum, {
  name: 'RainCondition',
  description: 'Rain forecast at scheduled time for scheduled ride pricing',
});

registerEnumType(HistoricalTrafficEnum, {
  name: 'HistoricalTraffic',
  description: 'Historical traffic at scheduled time for scheduled ride pricing',
});

registerEnumType(DriverActionEnum, {
  name: 'DriverAction',
  description: 'Driver response to a ride request',
});

/**
 * Input for triggering an INSTANT matchmaking process.
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
 * Input for triggering a SCHEDULED matchmaking process.
 */
@InputType()
export class MatchScheduledDriversInput {
  @Field(() => String)
  @IsString()
  rideId: string;

  @Field(() => RainConditionEnum, { nullable: true, defaultValue: RainConditionEnum.NONE })
  @IsOptional()
  @IsEnum(RainConditionEnum)
  rain?: RainConditionEnum;

  @Field(() => HistoricalTrafficEnum, { nullable: true, defaultValue: HistoricalTrafficEnum.LOW })
  @IsOptional()
  @IsEnum(HistoricalTrafficEnum)
  historicalTraffic?: HistoricalTrafficEnum;
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
 * Input for fetching estimated fare (instant).
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

/**
 * Input for fetching estimated scheduled fare.
 */
@InputType()
export class ScheduledFareInput {
  @Field(() => String)
  @IsString()
  rideId: string;

  @Field(() => RainConditionEnum, { nullable: true })
  @IsOptional()
  @IsEnum(RainConditionEnum)
  rain?: RainConditionEnum;

  @Field(() => HistoricalTrafficEnum, { nullable: true })
  @IsOptional()
  @IsEnum(HistoricalTrafficEnum)
  historicalTraffic?: HistoricalTrafficEnum;
}