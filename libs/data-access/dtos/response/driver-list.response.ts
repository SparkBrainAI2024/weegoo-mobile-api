// driver-list-item.response.ts
import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
// driver-list.response.ts
import { Paginated } from "@libs/data-access/base/base.response";
import { BasicResponse } from "./basic.response";

@ObjectType()
export class DriverListItem {
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
  totalRidesAsDriver: number;

  @Field(() => Float, { defaultValue: 0 })
  totalEarnings: number;

  @Field(() => Float, { defaultValue: 0 })
  rating: number;

  @Field(() => String, { nullable: true })
  joinedDate?: string;
}

@ObjectType()
export class DriverListResponse extends Paginated(DriverListItem) {
  @Field(() => Number)
  totalPending: number;

  @Field(() => Number)
  totalBlocked: number;
}
