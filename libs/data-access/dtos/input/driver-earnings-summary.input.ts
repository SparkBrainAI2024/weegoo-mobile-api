import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsDate, IsEnum } from 'class-validator';
export enum EarningsPeriod {
  TODAY = 'TODAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  CUSTOM = 'CUSTOM',
}

registerEnumType(EarningsPeriod, {
  name: 'EarningsPeriod',
  description: 'Period for driver earnings summary',
  valuesMap: {
    TODAY: { description: 'Today earnings' },
    WEEK: { description: 'This week earnings' },
    MONTH: { description: 'This month earnings' },
    CUSTOM: { description: 'Custom date range earnings' },
  },
});

@InputType()
export class DriverEarningsSummaryInput {
  @Field(() => EarningsPeriod)
  @IsEnum(EarningsPeriod)
  period: EarningsPeriod;

  @Field(() => Date )
  @IsDate()
  fromDate: Date;

  @Field(() => Date)
  @IsDate()
  toDate: Date;
}