import { Field, Int, ObjectType } from "@nestjs/graphql";
import { ExpirationResponse } from "./expiration.response";

@ObjectType()
export class SignUpResponse  extends ExpirationResponse {
  @Field()
  message: string;

  @Field()
  success: boolean;
}