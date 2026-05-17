import { DriverDocumentSide, DriverDocumentType } from "@libs/data-access/enums/driver-document.enum";
import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";

@InputType()
export class UpsertDocumentFileInput {
  @Field(() => DriverDocumentType)
  @IsEnum(DriverDocumentType)
  documentType: DriverDocumentType;

  @Field(() => DriverDocumentSide)
  @IsEnum(DriverDocumentSide)
  side: DriverDocumentSide;

  @Field()
  @IsString()
  @IsNotEmpty()
  s3Key: string;    // from requestUpload + client PUT — no session, trusted directly
}