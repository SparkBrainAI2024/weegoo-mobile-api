import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class RequestUploadResponse {
  @Field()
  uploadUrl: string;

  @Field()
  s3Key: string;

  @Field(() => Int)
  expiresInSeconds: number;
}