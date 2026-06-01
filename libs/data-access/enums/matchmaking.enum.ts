import { Field, InputType, registerEnumType, Float } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum RainConditionEnum {
  NONE = 'none',
  LIGHT = 'light',
  HEAVY = 'heavy',
}

export enum HistoricalTrafficEnum {
  LOW = 'low',
  MODERATE = 'moderate',
  HEAVY = 'heavy',
}

export enum DriverActionEnum {
  ACCEPT = 'accept',
  REJECT = 'reject',
}

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
