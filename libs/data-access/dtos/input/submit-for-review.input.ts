import { DriverDocumentType } from "@driver-api/enums/driver-document.enum";
import { Field, InputType } from "@nestjs/graphql";
import { IsEnum } from "class-validator";

@InputType()
export class SubmitDocumentForReviewInput {
  @Field(() => String)
  @IsEnum(DriverDocumentType)
  documentType: DriverDocumentType;
}