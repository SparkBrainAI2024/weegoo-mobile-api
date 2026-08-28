import { Field, InputType, Int } from "@nestjs/graphql";
import { PaymentsPeriodEnum } from "../../enums/payments-period.enum";
import {
  TransactionStatus,
  TransactionType,
} from "../../enums/transaction.enum";

@InputType()
export class PaymentsOverviewInput {
  @Field(() => PaymentsPeriodEnum, {
    nullable: true,
    defaultValue: PaymentsPeriodEnum.THIS_MONTH,
  })
  period?: PaymentsPeriodEnum;

  @Field(() => Date, { nullable: true })
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  endDate?: Date;
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
