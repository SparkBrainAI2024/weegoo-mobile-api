import { Issue } from "../../entities/issue.entity";
import { BasicResponse } from "./basic.response";
// types/issue-list.response.ts
import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import {
  IssuePriority,
  IssueStatus,
  ReportedByType,
} from "../../enums/issue.enum";

@ObjectType()
export class CreateIssueResponse extends BasicResponse {
  @Field(() => Issue, { nullable: true })
  issue?: Issue;
}

@ObjectType()
export class IssuePagination {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}

// One row in the table. Flattened/joined shape — not a 1:1 mirror of the Issue
// schema, since the UI needs reporter name + assignee name, not raw ids.
@ObjectType()
export class IssueSummary {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  ticketCode: string; // derived, e.g. "REP-10482" — see repository for how it's built

  @Field(() => Date)
  createdAt: Date;

  @Field(() => String)
  reportedByName: string;

  @Field(() => ReportedByType)
  reportedByType: ReportedByType;

  @Field(() => String, { nullable: true })
  rideId?: string;

  @Field(() => String, { nullable: true })
  categoryLabel?: string;

  @Field(() => IssueStatus)
  status: IssueStatus;

  @Field(() => IssuePriority, { nullable: true })
  priority: IssuePriority;

  @Field(() => String, { nullable: true })
  assigneeName?: string; // null => "Unassigned" in the UI
}

@ObjectType()
export class IssueListResponse {
  @Field(() => [IssueSummary])
  items: IssueSummary[];

  @Field(() => IssuePagination)
  pagination: IssuePagination;

  // Counts reflect the CURRENT filters (minus status itself) except date range,
  // which does apply — matches how the stat cards should read when a date
  // range is picked. See repository note on this.
  @Field(() => Int)
  totalOpen: number;

  @Field(() => Int)
  totalInReview: number;

  @Field(() => Int)
  totalResolved: number;

  @Field(() => String, { nullable: true })
  avgFirstResponse?: string; // e.g. "12m" — placeholder until you have a first-response timestamp to diff against

  @Field(() => String, { nullable: true })
  avgResolution?: string; // e.g. "30m" — computed from resolvedAt - createdAt
}

@ObjectType()
export class ResolveIssueResponse {
  @Field(() => String)
  message: string;

  @Field(() => ID)
  id: string;

  @Field(() => IssueStatus)
  status: IssueStatus;
}

@ObjectType()
export class IssuePerson {
  @Field(() => String)
  role: string;

  @Field(() => String, { nullable: true })
  fullName: string | null;

  @Field(() => String, { nullable: true })
  phone: string | null;

  @Field(() => String, { nullable: true })
  displayId: string | null;

  @Field(() => ID, { nullable: true })
  userId: string | null;

  @Field(() => Boolean)
  suspended: boolean;
}

@ObjectType()
export class RideInIssue {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  rideUUId: string;
}

@ObjectType()
export class IssueDetailResponse {
  @Field(() => ID)
  id: string;

  @Field(() => RideInIssue)
  rideId: RideInIssue;

  @Field(() => IssueStatus)
  status: IssueStatus;

  @Field(() => IssuePriority)
  priority: IssuePriority;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => String)
  issueContent: string;

  @Field(() => IssuePerson)
  reporter: IssuePerson;

  @Field(() => IssuePerson)
  reportee: IssuePerson;

  @Field(() => String)
  ticketCode: string;

  @Field(() => String, { nullable: true })
  categoryLabel: string | null;
}

@ObjectType()
export class CloseIssueResponse {
  @Field(() => String)
  message: string;

  @Field(() => ID)
  id: string;

  @Field(() => IssueStatus)
  status: IssueStatus;
}

@ObjectType()
export class BulkResolveIssuesResponse {
  @Field(() => String)
  message: string;

  @Field(() => Int)
  resolvedCount: number;
}
