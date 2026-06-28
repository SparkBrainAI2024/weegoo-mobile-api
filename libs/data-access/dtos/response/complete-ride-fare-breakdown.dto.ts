import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CompleteRideFareBreakdown {
  @Field(() => Float)
  baseFare: number;

  @Field(() => Float)
  distanceCharge: number;

  @Field(() => Float)
  discount: number;

  @Field(() => Float)
  totalFare: number;
}
