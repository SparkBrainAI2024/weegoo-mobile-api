// driver-list-item.response.ts
import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
// driver-list.response.ts
import { Paginated } from "@libs/data-access/base/base.response";
import { BasicResponse } from "./basic.response";

@ObjectType()
export class PassengerListItem {
  @Field(() => String)
  id: string;

  @Field(() => String)
  fullName: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  profileImage?: string;

  @Field(() => String)
  status: string;

  @Field(() => Boolean, { nullable: true })
  suspended?: boolean;

  @Field(() => Int, { defaultValue: 0 })
  totalTripsAsPassenger: number;

  @Field(() => Float, { defaultValue: 0 })
  totalSpendingOnRides: number;

  @Field(() => Float, { defaultValue: 0 })
  rating: number;

  @Field(() => String, { nullable: true })
  joinedDate?: string;
}

@ObjectType()
export class PassengerListResponse extends Paginated(PassengerListItem) {}
