import { Field, Float, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DriverCommissionSummary {
  @Field(() => Float)
  outstandingToPay: number; // from UserDetails.amountDueToCompany

  @Field(() => Float, { nullable: true })
  commissionPaid?: number; // not tracked yet — null

  @Field(() => Int)
  totalRides: number; // UserDetails.totalRidesAsDriver

  @Field({ nullable: true })
  lastSettlementDate?: string; // not tracked yet — null

  @Field(() => Float, { nullable: true })
  lastSettlementAmount?: number; // not tracked yet — null

  @Field({ nullable: true })
  lastSettlementMethod?: string; // not tracked yet — null
}
