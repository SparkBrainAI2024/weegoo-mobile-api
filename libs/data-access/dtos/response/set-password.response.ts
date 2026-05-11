import { Field, ObjectType } from "@nestjs/graphql";
import { CoreUserDetailsResponse } from "./core-user-details.response";
import { UserDetailsResponse } from "./user-detail.response";

@ObjectType()
export class SetPasswordResponse {
  @Field(() => CoreUserDetailsResponse)
  user: CoreUserDetailsResponse;

  @Field(() => UserDetailsResponse)
  userDetails: UserDetailsResponse;
}