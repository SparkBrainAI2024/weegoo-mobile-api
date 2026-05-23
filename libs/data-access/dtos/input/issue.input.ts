import { Field, InputType, Int } from '@nestjs/graphql';
import { IssueCategory, IssueStatus } from '@libs/data-access/enums/issue.enum';

@InputType()
export class CreateIssueInput {
  @Field(() => String, { nullable: true })
  rideId?: string;

  @Field(() => IssueCategory)
  category: IssueCategory;

  @Field(() => String)
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

  @Field(() => IssueCategory, { nullable: true })
  category?: IssueCategory;

  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  limit: number;
}

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  limit: number;
}