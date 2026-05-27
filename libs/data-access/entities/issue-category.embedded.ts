// issue-group.embed.ts

import { Field, ID, ObjectType } from '@nestjs/graphql';
import { IssueParentCategory } from '../enums/issue.enum';
import { Schema as MongooseSchema } from 'mongoose';

@ObjectType()
export class IssueCategoryEmbed {
  @Field(() => IssueParentCategory)
  parentCategory: IssueParentCategory;

  @Field(() => ID, { nullable: true })
  subCategoryId?: string;

  @Field(() => String, { nullable: true })
  subCategoryLabel?: string;
}

export const IssueCategoryEmbedSchema = {
  parentCategory:   { type: String, enum: IssueParentCategory, required: true },
  subCategoryId:    { type: MongooseSchema.Types.ObjectId, ref: 'IssueCategory', default: null },
  subCategoryLabel: { type: String, default: null },
};