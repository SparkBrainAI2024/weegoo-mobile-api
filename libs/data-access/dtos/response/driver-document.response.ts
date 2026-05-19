import {  DriverDocumentBundleStatus, DriverDocumentType } from "@libs/data-access/enums/driver-document.enum";
import { Field, ObjectType } from "@nestjs/graphql";
import { DriverDocumentFileResponse } from "./driver-document-file.response";

@ObjectType()
export class DriverDocumentResponse {
  @Field({ nullable: true })
  _id?: string;

  @Field(() => DriverDocumentType, { nullable: true })
  type?: DriverDocumentType;

  @Field(() => [DriverDocumentFileResponse], { nullable: true })
  files?: DriverDocumentFileResponse[];

  @Field(() => DriverDocumentBundleStatus, { nullable: true })
  status?: DriverDocumentBundleStatus;
}
