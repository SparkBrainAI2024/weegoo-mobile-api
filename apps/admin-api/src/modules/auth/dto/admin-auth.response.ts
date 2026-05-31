import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class CreateAdminResponse {
  @Field()
  message: string;
}