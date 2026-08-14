// service/issue.service.ts
import {
  BulkResolveIssuesResponse,
  CloseIssueResponse,
  Issue,
  IssueListResponse,
  ResolveIssueResponse,
} from "@libs/data-access";
import { IssueListInput } from "@libs/data-access/dtos/input/issue.list.input";
import { IssueRepository } from "@libs/data-access/repositories/issue.repository";
import { Injectable, NotFoundException } from "@nestjs/common";

function formatMinutes(minutes: number | null): string | undefined {
  if (minutes === null || Number.isNaN(minutes)) return undefined;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

@Injectable()
export class IssueService {
  constructor(private readonly issueRepository: IssueRepository) {}

  async getIssueList(input: IssueListInput): Promise<IssueListResponse> {
    const result = await this.issueRepository.getIssueList(input);

    return {
      items: result.items,
      pagination: result.pagination,
      totalOpen: result.totalOpen,
      totalInReview: result.totalInReview,
      totalResolved: result.totalResolved,
      avgFirstResponse: undefined,
      avgResolution: formatMinutes(result.avgResolutionMinutes),
    };
  }

  async closeIssue(id: string, closedBy: string): Promise<CloseIssueResponse> {
    const updated = await this.issueRepository.closeOne(id, closedBy);
    if (!updated) throw new NotFoundException(`Issue ${id} not found`);
    return {
      message: "Issue closed",
      id: updated._id.toString(),
      status: updated.status,
    };
  }

  async getIssueDetail(id: string): Promise<Issue> {
    return this.issueRepository.findById(id);
  }

  async resolveIssue(
    id: string,
    resolvedBy: string,
  ): Promise<ResolveIssueResponse> {
    const updated = await this.issueRepository.resolveOne(id, resolvedBy);
    if (!updated) throw new NotFoundException(`Issue ${id} not found`);
    return {
      message: "Issue resolved",
      id: updated._id.toString(),
      status: updated.status,
    };
  }

  async bulkResolveIssues(
    ids: string[],
    resolvedBy: string,
  ): Promise<BulkResolveIssuesResponse> {
    const resolvedCount = await this.issueRepository.resolveMany(
      ids,
      resolvedBy,
    );
    return {
      message: `${resolvedCount} issue${resolvedCount === 1 ? "" : "s"} resolved`,
      resolvedCount,
    };
  }
}
