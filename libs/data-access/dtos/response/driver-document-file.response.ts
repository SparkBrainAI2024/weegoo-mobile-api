import { Field, ObjectType } from "@nestjs/graphql";
import { DocumentFileStatus } from "@libs/data-access/enums/upload.enum";
import { DriverDocumentSide } from "@libs/data-access/enums/driver-document.enum";

@ObjectType()
export class DriverDocumentFileResponse {
  @Field(() => DriverDocumentSide)
  side: DriverDocumentSide;

  @Field()
  s3Key: string;

  @Field()
  isActive: boolean;

  @Field(() => DocumentFileStatus)
  status: DocumentFileStatus;

  @Field(() => String, { nullable: true })
  verifiedBy?: string;

  @Field(() => Date, { nullable: true })
  verifiedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  success: boolean;

  @Field()
  message: string;
}