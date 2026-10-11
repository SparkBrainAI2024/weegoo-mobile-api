import { Field, Float, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AdminProfileResponse {
  @Field(() => ID) _id: string;
  @Field() fullName: string;
  @Field() email: string;
  @Field(() => String, { nullable: true }) phone?: string | null;
}
