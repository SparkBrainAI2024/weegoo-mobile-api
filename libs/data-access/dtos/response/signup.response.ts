import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class SignUpResponse {
  @Field()
  message: string;

  @Field()
  success: boolean;

  @Field(() => Int, { nullable: true })
  currentTime?: number;

  @Field(() => Int, { nullable: true })
  expiresBy?: number;
} 