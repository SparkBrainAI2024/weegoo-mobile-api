import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IssueParentCategory } from '../enums/issue.enum';

export type IssueCategoryDocument = IssueCategory & Document;

@ObjectType()
@Schema({ timestamps: true })
export class IssueCategory {
  @Field(() => ID)
  _id: string;

  // e.g. "RIDE", "CANCEL" — drives which group this belongs to
  @Field(() => IssueParentCategory)
  @Prop({ required: true, type: String, enum: IssueParentCategory, index: true })
  parentCategory: IssueParentCategory;

  // Human-readable label shown in the app, e.g. "Driver took wrong route"
  @Field(() => String)
  @Prop({ required: true, type: String, trim: true })
  label: string;


  // Controls ordering within a parent group
  @Field(() => Number)
  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Field(() => Boolean)
  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

export const IssueCategorySchema = SchemaFactory.createForClass(IssueCategory);

IssueCategorySchema.index({ parentCategory: 1, isActive: 1 });
IssueCategorySchema.index({ parentCategory: 1, sortOrder: 1 });