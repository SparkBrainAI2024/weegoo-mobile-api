import { Field, InputType, Int } from '@nestjs/graphql';
import { Min } from 'class-validator';

@InputType()
export class TransactionPaginationInput {
  @Field(() => Int, { defaultValue: 10 })
  @Min(1)
  limit: number = 10;

  @Field(() => Int, { defaultValue: 0 })
  @Min(0)
  page: number = 0;
}