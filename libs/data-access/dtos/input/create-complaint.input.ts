import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { IssueCategoryForRole, IssueParentCategory } from '../../enums/issue.enum';

@InputType()
export class ComplaintCategoryInput {
  @Field(() => IssueParentCategory)
  parentCategory: IssueParentCategory;

  @Field(() => IssueCategoryForRole)
  category: IssueCategoryForRole;

  @Field({ nullable: true })
  subCategoryId?: string;
}

@InputType()
export class CreateComplaintInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  complaintContent: string;

  @Field(() => ComplaintCategoryInput)
  @IsNotEmpty()
  category: ComplaintCategoryInput;
}