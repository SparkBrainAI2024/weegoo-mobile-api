import { DriverDocument } from "@libs/data-access/entities/driver-document.entity";
import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DriverDocumentConfirmUploadResponse {
  @Field()
  message: string;

  @Field()
  success: boolean;

  @Field(() => DriverDocument)
  driverDocument?: DriverDocument;
}