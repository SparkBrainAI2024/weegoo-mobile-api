import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { BaseEntity } from "@libs/data-access/base/base.entity";
import { DocumentFile, DocumentFileSchema } from "./document-file.embedded";
import { DriverDocumentBundleStatus, DriverDocumentType } from "@driver-api/enums/driver-document.enum";

export type DriverDocumentDocument = HydratedDocument<DriverDocument>;

@ObjectType()
@Schema({ timestamps: true })
export class DriverDocument extends BaseEntity {
  @Field(() => String)
  @Prop({ type: Types.ObjectId, required: true, ref: "User", index: true })
  driverId: Types.ObjectId;

  @Field(() => String)
  @Prop({ type: String, required: true, enum: DriverDocumentType, index: true })
  type: DriverDocumentType;

  // Each side can have max 2 entries: one isActive=true, one isActive=false
  // The isActive=false one is deleted at midnight and removed from array
  @Field(() => [DocumentFile])
  @Prop({ type: [DocumentFileSchema], default: [] })
  files: DocumentFile[];

  // Bundle-level review status
  @Field(() => String)
  @Prop({
    type:    String,
    enum:    DriverDocumentBundleStatus,
    default: DriverDocumentBundleStatus.DRAFT,
    index:   true,
  })
  status: DriverDocumentBundleStatus;

  @Field(() => String, { nullable: true })
  @Prop({ type: Types.ObjectId, default: null, ref: "User" })
  reviewedBy?: Types.ObjectId;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: null })
  reviewedAt?: Date;

  @Field({ nullable: true })
  @Prop({ type: String, default: null })
  rejectionReason?: string;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: null })
  submittedAt?: Date;
}

export const DriverDocumentSchema = SchemaFactory.createForClass(DriverDocument);

// One bundle per driver + document type
DriverDocumentSchema.index({ driverId: 1, type: 1 }, { unique: true });