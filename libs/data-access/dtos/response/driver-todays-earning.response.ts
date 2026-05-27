import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DriverTodayEarningResponse {
  @Field(() => Float)
  totalCredit: number;

  @Field(() => Float)
  totalDebit: number;

  @Field(() => Float)
  netEarning: number;
}