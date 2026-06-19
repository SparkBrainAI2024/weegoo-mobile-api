import { Field, ObjectType } from "@nestjs/graphql";
import { Rides } from "../../entities/rides.entity";

@ObjectType()
export class RideGroup {
  @Field()
  title: string;

  @Field(() => [Rides])
  rides: Rides[];
}