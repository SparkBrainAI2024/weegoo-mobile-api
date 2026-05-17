import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { UploadPurpose } from "../../enums/upload.enum";

@InputType()
export class ConfirmUploadInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @Field(() => UploadPurpose,{
    description:"Purpose for uploading, namely national id, blue book and others"
  })
  @IsEnum(UploadPurpose, { message: "DOCUMENT.INVALID_TYPE" })
  purpose: UploadPurpose;
}