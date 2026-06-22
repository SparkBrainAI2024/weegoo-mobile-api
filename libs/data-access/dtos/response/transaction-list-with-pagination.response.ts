import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { Pagination } from "@libs/data-access/base/base.response";
import { Transaction } from "@libs/data-access/entities/transaction.entity";

@ObjectType()
export class TransactionListWithPaginationResponse {
  @Field(() => [Transaction], { nullable: true })
  data: Transaction[];

  @Field(() => Pagination)
  pagination: Pagination;

  @Field(() => Float, { nullable: true, defaultValue: 0 })
  walletAmount?: number;
}