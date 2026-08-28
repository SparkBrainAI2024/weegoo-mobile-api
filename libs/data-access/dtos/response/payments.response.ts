import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
  WalletUserType,
} from "../../enums/transaction.enum";

@ObjectType()
export class StatCard {
  @Field(() => Float)
  value: number;

  @Field(() => Float, { nullable: true })
  percentChange?: number;

  @Field(() => Boolean, { nullable: true })
  isIncrease?: boolean;
}

@ObjectType()
export class PaymentsSummaryResponse {
  @Field(() => StatCard)
  totalCommission: StatCard;

  @Field(() => StatCard)
  driverWalletBalance: StatCard;

  @Field(() => StatCard)
  customerWalletBalance: StatCard;

  @Field(() => StatCard)
  totalTransactions: StatCard;
}

@ObjectType()
export class ChartPoint {
  @Field(() => String)
  date: string;

  @Field(() => Float)
  amount: number;
}

@ObjectType()
export class CommissionOverviewResponse {
  @Field(() => Float)
  totalCommission: number;

  @Field(() => Float, { nullable: true })
  percentChange?: number;

  @Field(() => [ChartPoint])
  series: ChartPoint[];
}

@ObjectType()
export class WalletBalanceSegment {
  @Field(() => String)
  label: string;

  @Field(() => Float)
  value: number;

  @Field(() => Float)
  percentage: number;
}

@ObjectType()
export class WalletBalancesResponse {
  @Field(() => Float)
  totalBalance: number;

  @Field(() => WalletBalanceSegment)
  driverWallet: WalletBalanceSegment;

  @Field(() => WalletBalanceSegment)
  customerWallet: WalletBalanceSegment;

  @Field(() => WalletBalanceSegment)
  commission: WalletBalanceSegment;
}

@ObjectType()
export class TopupWithdrawalResponse {
  @Field(() => StatCard)
  totalTopups: StatCard;

  @Field(() => StatCard)
  totalWithdrawals: StatCard;

  @Field(() => Float)
  netFlow: number;

  @Field(() => Float, { nullable: true })
  netFlowPercentChange?: number;

  @Field(() => [ChartPoint], { nullable: true })
  netFlowTrend?: ChartPoint[];
}

@ObjectType()
export class TransactionUserInfo {
  @Field(() => String, { nullable: true })
  userId?: string | null;

  @Field(() => String, { nullable: true })
  fullName?: string | null;

  @Field(() => String, { nullable: true })
  displayId?: string | null;

  @Field(() => WalletUserType, { nullable: true })
  userType?: WalletUserType | null;
}

@ObjectType()
export class TransactionResponse {
  @Field(() => String)
  id: string;

  @Field(() => TransactionType)
  type: TransactionType;

  @Field(() => TransactionUserInfo)
  user: TransactionUserInfo;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Float)
  amount: number;

  @Field(() => TransactionDirection)
  direction: TransactionDirection;

  @Field(() => TransactionStatus)
  status: TransactionStatus;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class PaginatedTransactionsResponse {
  @Field(() => [TransactionResponse])
  data: TransactionResponse[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}

@ObjectType()
export class PendingWithdrawalItem {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  fullName?: string | null;

  @Field(() => String, { nullable: true })
  displayId?: string | null;

  @Field(() => Float)
  amount: number;

  @Field(() => TransactionStatus)
  status: TransactionStatus;

  @Field(() => Date)
  requestedAt: Date;
}

@ObjectType()
export class PendingWithdrawalsResponse {
  @Field(() => [PendingWithdrawalItem])
  data: PendingWithdrawalItem[];

  @Field(() => Float)
  totalPending: number;
}
