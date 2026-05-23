import { Args, Field, InputType, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Issue } from '@libs/data-access/entities/issue.entity';
import { IssueService } from '../issue.service';
import { PaginationInput, User } from '@libs/data-access';
import { CreateIssueInput } from '@libs/data-access/dtos/input/create-issue.input';
import { IssueCategory, ReportedByType } from '@libs/data-access/enums/issue.enum';
import {roles} from '@libs/data-access/enums/user.enum'
import { CurrentLang, CurrentUser } from '@libs/common';
import { AuthGuard } from '@libs/guards';
import { CreateIssueResponse } from '@libs/data-access/dtos/response/issue.response';



@Resolver(() => Issue)
export class UsersIssueResolver {
  constructor(private readonly issueService: IssueService) {}

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
      input.category,
      input.issueContent,
      lang,
      input.rideId,
    );
  }


}