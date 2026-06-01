import { DriverActionEnum, HistoricalTrafficEnum, RainConditionEnum } from '@libs/data-access/enums/matchmaking.enum';
import { Field, InputType, Float } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum } from 'class-validator';

@InputType()
export class MatchDriversInput {
  @Field(() => String)
  @IsString()
  rideId: string;
}

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

@InputType()
export class DriverResponseInput {
  @Field(() => String)
  @IsString()
  rideId: string;

  @Field(() => String)
  @IsString()
  rideUUID: string;

  @Field(() => String)
  @IsString()
  driverId: string;

  @Field(() => DriverActionEnum)
  @IsEnum(DriverActionEnum)
  action: DriverActionEnum;
}

@InputType()
export class EstimatedFareInput {
  @Field(() => String)
  @IsString()
  rideId: string;
}

@InputType()
export class UpdateDriverLocationInput {
  @Field(() => String)
  @IsString()
  driverId: string;

  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;
}

@InputType()
export class UpdatePassengerLocationInput {
  @Field(() => String)
  @IsString()
  passengerId: string;

  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;
}

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
