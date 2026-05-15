import { Field, ObjectType } from "@nestjs/graphql";
import { CoreUserDetailsResponse } from "./core-user-details.response";
import { UserDetailsResponse } from "./user-detail.response";

@ObjectType()
export class VerifyGooglePhoneResponse {
  @Field()
  message: string;

  @Field()
  success: boolean;

  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => CoreUserDetailsResponse)
  user: CoreUserDetailsResponse;

  @Field(() => UserDetailsResponse)
  userDetails: UserDetailsResponse;
}