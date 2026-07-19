// dtos/response/rides-list.response.ts
import { Field, Int, ObjectType } from "@nestjs/graphql";
import { Rides } from "../../entities/rides.entity";

@ObjectType()
export class RidesListResponse {
  @Field(() => [Rides])
  rides: Rides[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}
