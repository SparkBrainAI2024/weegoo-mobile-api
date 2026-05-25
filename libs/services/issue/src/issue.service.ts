import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IssueRepository, IssueFilters, PaginationOptions } from '@libs/data-access/repositories/issue.repository';
import { Issue } from '@libs/data-access/entities/issue.entity';
import {  IssueParentCategory, IssueStatus, ReportedByType } from '@libs/data-access/enums/issue.enum';
import { CreateIssueResponse, IssueCategoryInput, RidesRepository } from '@libs/data-access';
import { Types } from 'mongoose';
import { Message } from '@libs/localization';
import { IssueCategoryEmbed } from '@libs/data-access/entities/issue-category.embedded';

// valid status transitions — no backwards movement
const VALID_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  [IssueStatus.OPEN]: [IssueStatus.IN_REVIEW],
  [IssueStatus.IN_REVIEW]: [IssueStatus.RESOLVED],
  [IssueStatus.RESOLVED]: [],
};


export const issueCategorySeed = [{ parentCategory: IssueParentCategory.RIDE, label: 'Driver is too slow', sortOrder: 1, isActive: true }, { parentCategory: IssueParentCategory.RIDE, label: 'Driver took wrong route', sortOrder: 2, isActive: true }, { parentCategory: IssueParentCategory.RIDE, label: 'Driver was rude', sortOrder: 3, isActive: true }, { parentCategory: IssueParentCategory.CANCEL, label: 'Driver cancelled last minute', sortOrder: 1, isActive: true }, { parentCategory: IssueParentCategory.CANCEL, label: 'Wrong cancellation charge', sortOrder: 2, isActive: true },]


@Injectable()
export class IssueService {
  constructor(
    private readonly issueRepo: IssueRepository,
    private readonly ridesRepo: RidesRepository,
  ) {}

 async createIssue(
  userId: string,
  reportedByType: ReportedByType,
  category: IssueCategoryInput,
  issueContent: string,
  lang: string,
  rideId?: string,
): Promise<CreateIssueResponse> {
  if (!issueContent || issueContent.trim().length < 10) {
    throw new BadRequestException('Issue content must be at least 10 characters.');
  }

  if (rideId) {
    const ride = await this.ridesRepo.findById(new Types.ObjectId(rideId));
    if (!ride) throw new NotFoundException('Ride not found.');
    const isPassenger = ride.passengerId?.toString() === userId;
    const isDriver = ride.driverId?.toString() === userId;
    if (!isPassenger && !isDriver) throw new UnauthorizedException('You are not associated with this ride.');
  }

  // fetch IssueCategory and build full embed
  let categoryEmbed: IssueCategoryEmbed | null = null;
  if (category) {
    const group = category.subCategoryId
      ? await this.issueRepo.findIssueCategoryById(category.subCategoryId)
      : null;

    categoryEmbed = {
      parentCategory: category.parentCategory,
      subCategoryId: group?._id?.toString() ?? null,
      subCategoryLabel: group?.label ?? null,
    };
  }

  const issue = await this.issueRepo.create({
    reportedBy: userId,
    reportedByType,
    category: categoryEmbed,
    issueContent: issueContent.trim(),
    rideId,
  });

  return {
    message: Message(lang, 'ISSUE.CREATED'),
    success: true,
    issue,
  };
}

  // passenger or driver views their own issues
  async getMyIssues(
    userId: string,
    options: PaginationOptions,
  ): Promise<{ items: Issue[]; total: number }> {
    return this.issueRepo.findByReportedBy(userId, options);
  }

  // admin views all issues with optional filters
  async getAllIssues(
    filters: IssueFilters,
    options: PaginationOptions,
  ): Promise<{ items: Issue[]; total: number }> {
    return this.issueRepo.findAll(filters, options);
  }

  // admin updates status — enforces valid transitions
  async updateIssueStatus(
    issueId: string,
    newStatus: IssueStatus,
  ): Promise<Issue> {
    const issue = await this.issueRepo.findById(issueId);
    if (!issue) throw new NotFoundException('Issue not found.');

    const allowed = VALID_TRANSITIONS[issue.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${issue.status} to ${newStatus}.`,
      );
    }

    return this.issueRepo.updateStatus(issueId, newStatus);
  }

  // admin resolves issue
  async resolveIssue(issueId: string, adminId: string): Promise<Issue> {
    const issue = await this.issueRepo.findById(issueId);
    if (!issue) throw new NotFoundException('Issue not found.');

    if (issue.status === IssueStatus.RESOLVED) {
      throw new BadRequestException('Issue is already resolved.');
    }

    return this.issueRepo.resolve(issueId, adminId);
  }


async seedIssueCategorys(): Promise<string> {
  await this.issueRepo.seedIssueCategorys(issueCategorySeed);

  return 'Issue groups seeded successfully';
}
}