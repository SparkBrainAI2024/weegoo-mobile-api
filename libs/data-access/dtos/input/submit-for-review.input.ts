import { DriverDocumentType } from "@libs/data-access/enums/driver-document.enum";
import { Field, InputType } from "@nestjs/graphql";
import { IsEnum } from "class-validator";

@InputType()
export class SubmitDocumentForReviewInput {
  @Field(() => DriverDocumentType)
  @IsEnum(DriverDocumentType)
  documentType: DriverDocumentType;
}