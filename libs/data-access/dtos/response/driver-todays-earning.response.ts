import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DriverTodayEarningResponse {


  @Field(() => Float)
  netEarning: number;
}