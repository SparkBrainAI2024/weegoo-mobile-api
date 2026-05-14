import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ConfirmUploadResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}