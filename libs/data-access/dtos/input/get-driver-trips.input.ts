import { Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum DriverTripCommissionFilter {
  ALL = 'ALL',
  DUE = 'DUE',
  PAID = 'PAID',
}

registerEnumType(DriverTripCommissionFilter, {
  name: 'DriverTripCommissionFilter',
  description: 'Filter driver trips by commission status',
  valuesMap: {
    ALL: { description: 'All trips regardless of commission status' },
    DUE: { description: 'Only trips where commission is due (pending)' },
    PAID: { description: 'Only trips where commission is paid (completed)' },
  },
});

@InputType()
export class GetDriverTripsInput {
  @Field(() => DriverTripCommissionFilter, {
    defaultValue: DriverTripCommissionFilter.ALL,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(DriverTripCommissionFilter)
  filter?: DriverTripCommissionFilter;

  @Field(() => Int, { defaultValue: 0, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  page?: number;

  @Field(() => Int, { defaultValue: 10, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}