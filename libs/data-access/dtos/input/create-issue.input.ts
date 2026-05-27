import {  IssueParentCategory, IssueStatus } from '@libs/data-access/enums/issue.enum';
import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum, IsMongoId, MinLength } from 'class-validator';

// create-issue.input.ts
@InputType()
export class IssueCategoryInput {
  @Field(() => IssueParentCategory)
  @IsEnum(IssueParentCategory)
  parentCategory: IssueParentCategory;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  subCategoryId?: string;
}

@InputType()
export class CreateIssueInput {
  @Field(() => IssueCategoryInput, { nullable: true })
  @IsOptional()
  category?: IssueCategoryInput;

  @Field(() => String, { nullable: true })
  @IsOptional()
  rideId?: string;

  @Field()
  @MinLength(10)
  issueContent: string;
}

@InputType()
export class UpdateIssueStatusInput {
  @Field(() => String)
  issueId: string;

  @Field(() => IssueStatus)
  status: IssueStatus;
}

@InputType()
export class ResolveIssueInput {
  @Field(() => String)
  issueId: string;
}

@InputType()
export class GetAllIssuesInput {
  @Field(() => IssueStatus, { nullable: true })
  status?: IssueStatus;



  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  limit: number;
}

