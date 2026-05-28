import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { IssueCategoryForRole, IssueParentCategory } from '../../enums/issue.enum';

@InputType()
export class IssueCategoryInput {
  @Field(() => IssueParentCategory)
  @IsEnum(IssueParentCategory)
  parentCategory: IssueParentCategory;

  @Field(() => IssueCategoryForRole)
  @IsEnum(IssueCategoryForRole)
  category: IssueCategoryForRole;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  subCategoryId?: string;
}

@InputType()
export class CreateIssueInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  title: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  issueContent: string;

  @Field(() => IssueCategoryInput)
  @IsNotEmpty()
  category: IssueCategoryInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  rideId?: string;
}