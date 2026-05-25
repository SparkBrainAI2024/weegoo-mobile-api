// issue-category.embed.ts

import { Field, ID, ObjectType } from '@nestjs/graphql';
import { IssueParentCategory } from '../enums/issue.enum';

@ObjectType()
export class IssueCategoryEmbed {
  @Field(() => IssueParentCategory)
  parentCategory: IssueParentCategory;

  @Field(() => ID, { nullable: true })
  subCategoryId?: string;

  @Field(() => String, { nullable: true })
  subCategoryLabel?: string;
}