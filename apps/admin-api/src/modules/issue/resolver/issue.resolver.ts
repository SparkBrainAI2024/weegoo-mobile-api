// resolver/issue.resolver.ts
//
// Matches your DriverResolver's style: no active guard yet (commented, same as
// yours), @CurrentLang() where relevant, plain @Args for everything else.
//
// ⚠️ ONE OPEN DECISION: DriverResolver has no @CurrentUser()/@CurrentAdmin()
// decorator either — nothing in your codebase currently tells a resolver WHO
// the logged-in admin is. So `resolveIssue`/`bulkResolveIssues` below take
// `resolvedBy` as an explicit argument for now (the frontend would send the
// logged-in admin's id). This is a stopgap, not a security model — once you
// add real admin auth (the commented @UseGuards/@SetMetadata above suggests
// it's coming), swap the `resolvedBy` argument for a decorator pulling it off
// the request/JWT, same as you'll presumably do for DriverResolver too.

import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { CurrentLang } from "@libs/common/decorators/header.decorators";
import {
  IssueDetailInput,
  IssueListInput,
} from "@libs/data-access/dtos/input/issue.list.input";
import {
  BulkResolveIssuesResponse,
  CloseIssueResponse,
  CreateIssueResponse,
  Issue,
  IssueDetailResponse,
  IssueListResponse,
  IssueStatus,
  ResolveIssueResponse,
} from "@libs/data-access";
import { IssueService } from "../issue.service";

// @UseGuards(AuthGuard, RoleGuard)
// @SetMetadata('roles', [roles.ADMIN])
@Resolver(() => Issue)
export class IssueResolver {
  constructor(private readonly issueService: IssueService) {}

  @Query(() => IssueListResponse)
  async getIssues(
    @Args("input", { nullable: true, type: () => IssueListInput })
    input?: IssueListInput,
    @CurrentLang() lang?: string,
  ): Promise<IssueListResponse> {
    return this.issueService.getIssueList(input ?? new IssueListInput());
  }

  @Query(() => IssueDetailResponse)
  async getIssueDetail(
    @Args("input", {
      type: () => IssueDetailInput,
    })
    input?: IssueDetailInput,
    @CurrentLang() lang?: string,
  ): Promise<IssueDetailResponse> {
    return this.issueService.getIssueDetail(input.id);
  }

  @Mutation(() => ResolveIssueResponse)
  async resolveIssue(
    @Args("id", { type: () => ID }) id: string,
    @Args("resolvedBy", { type: () => ID }) resolvedBy: string, // TODO: replace with current-admin decorator once auth lands
    @CurrentLang() lang: string,
  ): Promise<ResolveIssueResponse> {
    return this.issueService.resolveIssue(id, resolvedBy);
  }

  @Mutation(() => CloseIssueResponse)
  async closeIssue(
    @Args("id", { type: () => ID }) id: string,
    @Args("closedBy", { type: () => ID }) closedBy: string,
    @CurrentLang() lang: string,
  ): Promise<CloseIssueResponse> {
    return this.issueService.closeIssue(id, closedBy);
  }

  @Mutation(() => BulkResolveIssuesResponse)
  async bulkResolveIssues(
    @Args("ids", { type: () => [ID] }) ids: string[],
    @Args("resolvedBy", { type: () => ID }) resolvedBy: string,
    @CurrentLang() lang: string,
  ): Promise<BulkResolveIssuesResponse> {
    return this.issueService.bulkResolveIssues(ids, resolvedBy);
  }

  @Mutation(() => CreateIssueResponse)
  async updateIssueStatus(
    @Args("id", { type: () => ID }) id: string,
    @Args("status", { type: () => IssueStatus }) status: IssueStatus,
    @CurrentLang() lang: string,
  ): Promise<CreateIssueResponse> {
    return this.issueService.updateIssueStatus(id, status, lang);
  }
}
