import { ObjectType } from "@nestjs/graphql";
import { Paginated } from "@libs/data-access/base/base.response";
import { Transaction } from "@libs/data-access/entities/transaction.entity";

@ObjectType()
export class TransactionListWithPaginationResponse extends Paginated(Transaction) {}