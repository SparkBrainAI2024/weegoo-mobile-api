import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { UploadPurpose } from "../../enums/upload.enum";

@InputType()
export class ConfirmUploadInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @Field(() => String)
  @IsEnum(UploadPurpose)
  purpose: UploadPurpose;
}