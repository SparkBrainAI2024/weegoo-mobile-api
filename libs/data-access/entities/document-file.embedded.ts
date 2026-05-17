import { Field, ObjectType } from "@nestjs/graphql";
import { DocumentFileStatus } from "@libs/data-access/enums/upload.enum";
import { DriverDocumentSide } from "../enums/driver-document.enum";

@ObjectType()
export class DocumentFile {
  @Field(() => DriverDocumentSide)
  side: DriverDocumentSide;

  @Field()
  s3Key: string;

  @Field()
  isActive: boolean;         // true = current, false = pending midnight deletion

  @Field(() => DocumentFileStatus)
  status: DocumentFileStatus; // PENDING | VERIFIED | REJECTED

  @Field(() => String, { nullable: true })
  verifiedBy?: string;        // admin userId who verified this specific side

  @Field(() => Date, { nullable: true })
  verifiedAt?: Date;

  @Field()
  createdAt: Date;
}

// Mongoose raw schema for use inside @Prop
export const DocumentFileSchema = {
  side:       { type: String, enum: Object.values(require("../enums/driver-document.enum").DriverDocumentSide), required: true },
  s3Key:      { type: String, required: true },
  isActive:   { type: Boolean, required: true, default: true },
  status:     { type: String, enum: ["PENDING", "VERIFIED", "REJECTED"], required: true, default: "PENDING" },
  verifiedBy: { type: String, default: null },
  verifiedAt: { type: Date,   default: null },
  createdAt:  { type: Date,   default: () => new Date() },
};