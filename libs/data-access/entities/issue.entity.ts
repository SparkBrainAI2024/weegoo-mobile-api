import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import {  IssueCategoryFor, IssueParentCategory, IssueStatus, ReportedByType } from '../enums/issue.enum';
import {  IssueCategoryEmbed, IssueCategoryEmbedSchema } from './issue-category.embedded';



export type IssueDocument = Issue & Document;

@ObjectType()
@Schema({ timestamps: true })
export class Issue {
  @Field(() => ID)
  _id: string;

  // who submitted — set from JWT token, never from input
  @Field(() => String)
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  reportedBy: string;

  @Field(() => ReportedByType)
  @Prop({ required: true, type: String, enum: ReportedByType })
  reportedByType: ReportedByType;

  // nullable — null means general issue not tied to a ride
  @Field(() => String, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'Rides', default: null, index: true })
  rideId?: string;

@Field(() => IssueCategoryEmbed, { nullable: true })
@Prop({ type: IssueCategoryEmbedSchema, default: null })
category?: IssueCategoryEmbed;
 
  @Field(() => String)
  @Prop({ required: true, type: String, minlength: 10 })
  issueContent: string;

  @Field(() => IssueStatus)
  @Prop({ required: true, type: String, enum: IssueStatus, default: IssueStatus.OPEN })
  status: IssueStatus;

  // set on resolve
  @Field(() => String, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'AdminUser', default: null })
  resolvedBy?: string;

  @Field(() => IssueCategoryFor)
@Prop({ type: String, enum: IssueCategoryFor, default: IssueCategoryFor.BOTH })
categoryFor: IssueCategoryFor;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: null })
  resolvedAt?: Date;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

export const IssueSchema = SchemaFactory.createForClass(Issue);

// indexes for frequent queries
IssueSchema.index({ reportedBy: 1 });
IssueSchema.index({ status: 1 });
IssueSchema.index({ rideId: 1 });
IssueSchema.index({ createdAt: -1 });