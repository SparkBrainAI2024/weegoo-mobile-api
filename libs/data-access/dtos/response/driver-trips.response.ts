import { Field, ID, ObjectType, Float } from "@nestjs/graphql";

@ObjectType()
export class DriverTripRow {
  @Field(() => ID)
  id: string;

  @Field()
  rideUUId: string;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  pickupLocation?: string;

  @Field({ nullable: true })
  dropoffLocation?: string;

  @Field(() => Float)
  fare: number;

  @Field({ nullable: true })
  paymentMethod?: string;

  @Field(() => Float, { nullable: true })
  driverCommission?: number;

  @Field(() => Float, { nullable: true })
  driverGets?: number;

  // Settlement status (Settled/Due) — not wired to WalletTransaction yet, null for now
  @Field({ nullable: true })
  status?: string;
}

@ObjectType()
export class PaginationInfo {
  @Field() total: number;
  @Field() page: number;
  @Field() limit: number;
  @Field() totalPages: number;
}

@ObjectType()
export class DriverTripsPage {
  @Field(() => [DriverTripRow])
  data: DriverTripRow[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;
}
