import { Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import { IsOptional, Min } from 'class-validator';
import { SortBy } from '../../base/base.input';

export enum RideFilterStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  ALL = 'all',
  CANCELLED = 'canceled',
}

export enum RideSortBy {
  BOOKING_TIME = 'bookingTime',
  CREATED_AT = 'createdAt',
}

registerEnumType(RideFilterStatus, {
  name: 'RideFilterStatus',
  description: 'Filter options for rides listing',
  valuesMap: {
    ONGOING: { description: 'Ongoing rides' },
    COMPLETED: { description: 'Completed rides' },
    ALL: { description: 'All rides' },
    CANCELLED: { description: 'Cancelled rides' },
  },
});

registerEnumType(RideSortBy, {
  name: 'RideSortBy',
  description: 'Sort by field for rides listing',
  valuesMap: {
    BOOKING_TIME: { description: 'Sort by booking time' },
    CREATED_AT: { description: 'Sort by created at' },
  },
});

@InputType()
export class GetAllRidesPaginationInput {
  @Field(() => Int, { defaultValue: 5 })
  @Min(5)
  limit: number = 5;

  @Field(() => String, { nullable: true })
  @IsOptional()
  cursor?: string;

  @Field(() => RideFilterStatus, { defaultValue: RideFilterStatus.ALL })
  @IsOptional()
  filter?: RideFilterStatus;

  @Field(() => RideSortBy, { defaultValue: RideSortBy.BOOKING_TIME })
  @IsOptional()
  sortBy?: RideSortBy;

  @Field(() => SortBy, { defaultValue: SortBy.desc })
  @IsOptional()
  order: SortBy = SortBy.desc;
}