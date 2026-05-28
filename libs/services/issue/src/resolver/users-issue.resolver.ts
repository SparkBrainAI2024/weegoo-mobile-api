import { Args, Field, InputType, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Issue } from '@libs/data-access/entities/issue.entity';
import { IssueService } from '../issue.service';
import { User } from '@libs/data-access';
import { CreateIssueInput } from '@libs/data-access/dtos/input/create-issue.input';
import { CategoryAccessedByRole, IssueParentCategory, ReportedByType } from '@libs/data-access/enums/issue.enum';
import { roles } from '@libs/data-access/enums/user.enum'
import { CurrentLang, CurrentUser } from '@libs/common';
import { AuthGuard } from '@libs/guards';
import { CreateIssueResponse } from '@libs/data-access/dtos/response/issue.response';
import { IssueCategory } from '@libs/data-access/entities/issue-category.entity';

@Resolver(() => Issue)
export class UsersIssueResolver {
  constructor(private readonly issueService: IssueService) { }

  @UseGuards(AuthGuard)
  @Mutation(() => CreateIssueResponse)
  async createIssue(
    @CurrentUser() user: User,
    @CurrentLang() lang,
    @Args('input') input: CreateIssueInput,
  ): Promise<CreateIssueResponse> {

    // reportedByType derived from user role — never from input
    const reportedByType =
      user.roles.includes(roles.RIDER) ? ReportedByType.DRIVER : ReportedByType.PASSENGER;

    return this.issueService.createIssue(
      user._id.toString(),
      reportedByType,
      input,
      lang

    );
  }
  @Mutation(() => String)
  async seedIssueCategorys(): Promise<string> {
    return this.issueService.seedIssueCategorys();
  }

@UseGuards(AuthGuard)
@Query(() => [IssueCategory])
async getIssueCategoriesByParent(
  @CurrentUser() user: User,
  @Args('parentCategory', { type: () => IssueParentCategory }) parentCategory: IssueParentCategory,
): Promise<IssueCategory[]> {
  const currentUserRole = user.loginAs;

  return this.issueService.getCategoriesByParent(parentCategory, currentUserRole === roles.RIDER ? CategoryAccessedByRole.DRIVER : CategoryAccessedByRole.PASSENGER);
}

}