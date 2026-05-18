import { Field, ObjectType } from "@nestjs/graphql";
import { ExpirationResponse } from "./expiration.response";

@ObjectType()
export class BasicExpirationResponse extends ExpirationResponse {
  @Field()
  message: string;

  @Field()
  success: boolean;
}
