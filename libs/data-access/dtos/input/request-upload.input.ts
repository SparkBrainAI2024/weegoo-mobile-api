import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { UploadPurpose } from "../../enums/upload.enum";

@InputType()
export class RequestUploadInput {
  @Field(() => UploadPurpose)
  @IsEnum(UploadPurpose)
  purpose: UploadPurpose;

  @Field()
  @IsString()
  @IsNotEmpty()
  contentType: string;
}