import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ExpirationResponse {
  @Field(() => Int, { nullable: true })
  currentTime?: number;

  @Field(() => Int, { nullable: true })
  expiresBy?: number;

  @Field({ nullable: true })
  verificationToken?: string;
}