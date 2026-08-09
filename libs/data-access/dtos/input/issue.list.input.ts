// dto/issue-list.input.ts
import { Field, ID, InputType } from "@nestjs/graphql";
import {
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
} from "class-validator";
import { PaginationInputOnly } from "@libs/data-access/base/base.input";

@InputType()
export class IssueListInput extends PaginationInputOnly {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string; // matches ticket code, reporter name, or ride id

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(["OPEN", "IN_REVIEW", "RESOLVED"])
  status?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  category?: string; // matches category.subCategoryLabel, or category.parentCategory if no sub-category

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(["HIGH", "MEDIUM", "LOW"])
  priority?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(["RIDER", "DRIVER"])
  reportedByType?: string; // the "From" filter in the UI

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsMongoId()
  assignedTo?: string; // pass the admin-user id; omit + pass unassignedOnly=true for "Unassigned"

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  unassignedOnly?: boolean;

  // ---- date range filter (from the screenshot's date picker) --------------
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  dateFrom?: string; // inclusive, e.g. "2026-08-01"

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  dateTo?: string; // inclusive, e.g. "2026-08-06"
}

@InputType()
export class ResolveIssueInput {
  @Field(() => ID)
  @IsMongoId()
  id: string;
}

@InputType()
export class BulkResolveIssuesInput {
  @Field(() => [ID])
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  ids: string[];
}
