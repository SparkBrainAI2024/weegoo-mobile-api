import { Field, InputType, Int } from "@nestjs/graphql";
import { PaymentsPeriodEnum } from "../../enums/payments-period.enum";
import {
  TransactionStatus,
  TransactionType,
} from "../../enums/transaction.enum";
import { TimeRangeFilter } from "@libs/data-access/enums/payment.enum";

@InputType()
export class PaymentsOverviewInput {
  @Field(() => TimeRangeFilter, {
    nullable: true,
    defaultValue: TimeRangeFilter.LAST_7_DAYS,
  })
  period?: TimeRangeFilter;
}

@InputType()
export class RecentTransactionsInput extends PaymentsOverviewInput {
  @Field(() => Int, { nullable: true, defaultValue: 0 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 5 })
  limit?: number;

  @Field(() => TransactionType, { nullable: true })
  type?: TransactionType;

  @Field(() => TransactionStatus, { nullable: true })
  status?: TransactionStatus;

  @Field(() => String, { nullable: true })
  searchText?: string;
}
