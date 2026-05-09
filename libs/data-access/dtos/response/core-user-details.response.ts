import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class CoreUserDetailsResponse {
  @Field({ nullable: true })
  email?: string;

  @Field()
  verified: boolean;

  @Field()
  suspended: boolean;

  @Field()
  profileCompleted: boolean;

  @Field()
  _id: string;

  @Field()
  language: string;

  @Field({ nullable: true })
  phone?: string;
}