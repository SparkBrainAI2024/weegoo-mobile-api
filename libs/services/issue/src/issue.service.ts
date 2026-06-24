import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IssueRepository, IssueFilters, PaginationOptions } from '@libs/data-access/repositories/issue.repository';
import { Issue } from '@libs/data-access/entities/issue.entity';
import { CategoryAccessedByRole, IssueCategoryForRole, IssueParentCategory, IssueStatus, ReportedByType } from '@libs/data-access/enums/issue.enum';
import { CreateIssueResponse, CreateComplaintInput, CreateComplaintResponse, IssueCategoryInput, RidesRepository, CreateIssueInput } from '@libs/data-access';
import { Types } from 'mongoose';
import { Message } from '@libs/localization';
import { IssueCategoryEmbed } from '@libs/data-access/entities/issue-category.embedded';
import { IssueCategory } from '@libs/data-access/entities/issue-category.entity';

// valid status transitions — no backwards movement
const VALID_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  [IssueStatus.OPEN]: [IssueStatus.IN_REVIEW],
  [IssueStatus.IN_REVIEW]: [IssueStatus.RESOLVED],
  [IssueStatus.RESOLVED]: [],
};


export const issueCategorySeed = [{ parentCategory: IssueParentCategory.RIDE, label: 'Driver is too slow', sortOrder: 1, isActive: true, categoryForRole: IssueCategoryForRole.PASSENGER }, { parentCategory: IssueParentCategory.RIDE, label: 'Driver took wrong route', sortOrder: 2, isActive: true, categoryForRole: IssueCategoryForRole.PASSENGER }, { parentCategory: IssueParentCategory.RIDE, label: 'Driver was rude', sortOrder: 3, isActive: true, categoryForRole: IssueCategoryForRole.DRIVER }, { parentCategory: IssueParentCategory.COMPLAINT, label: 'Wallet was not working', sortOrder: 1, isActive: true, categoryForRole: IssueCategoryForRole.BOTH }, { parentCategory: IssueParentCategory.CANCEL, label: 'Wrong cancellation charge', sortOrder: 2, isActive: true, categoryForRole: IssueCategoryForRole.BOTH },]


@Injectable()
export class IssueService {
  constructor(
    private readonly issueRepo: IssueRepository,
    private readonly ridesRepo: RidesRepository,
  ) {}

 async createIssue(
  userId: string,
  reportedByType: ReportedByType,
  input: CreateIssueInput, // Changed to accept the CreateIssueInput DTO
  lang: string,
): Promise<CreateIssueResponse> {
  const { category, issueContent, rideId, title } = input; // Destructure the input DTO

  if (!issueContent || issueContent.trim().length < 10) { // Use issueContent from input
    throw new BadRequestException('Issue content must be at least 10 characters.');
  }

  if (rideId) { // Use rideId from input
    const ride = await this.ridesRepo.findById(new Types.ObjectId(rideId)); // Use rideId from input
    if (!ride) throw new NotFoundException('Ride not found.');
    const isPassenger = ride.passengerId?.toString() === userId;
    const isDriver = ride.driverId?.toString() === userId;
    if (!isPassenger && !isDriver) throw new UnauthorizedException('You are not associated with this ride.');
  }

  // fetch IssueCategory and build full embed
  let categoryEmbed: IssueCategoryEmbed | null = null;
  if (category) { // Use category from input
    const group = category.subCategoryId // Use subCategoryId from input.category
      ? await this.issueRepo.findIssueCategoryById(category.subCategoryId) // Use subCategoryId from input.category
      : null;

    categoryEmbed = {
      parentCategory: category.parentCategory, // Use parentCategory from input.category
      subCategoryId: group?._id?.toString() ?? null,
      subCategoryLabel: group?.label ?? null,
    };
  }

  const issue = await this.issueRepo.create({
    title: title, // Added the missing title from input
    reportedBy: userId,
    reportedByType,
    category: categoryEmbed as any,
    issueContent: issueContent.trim(),
    rideId,
  });

  return {
    message: Message(lang, 'ISSUE.CREATED'),
    success: true,
    issue,
  };

  
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
  await this.issueRepo.seedIssueCategories(issueCategorySeed);

  return 'Issue categories seeded successfully';
}

  async getCategoriesByParent(
    parentCategory: IssueParentCategory,
    categoryAccessedByRole: CategoryAccessedByRole,
  ): Promise<IssueCategory[]> {
    return this.issueRepo.findByParentCategory(parentCategory, categoryAccessedByRole);
  }

  async createComplaint(
    userId: string,
    reportedByType: ReportedByType,
    input: CreateComplaintInput,
    lang: string,
  ): Promise<CreateComplaintResponse> {
    const { category, complaintContent } = input;

    if (!complaintContent || complaintContent.trim().length < 10) {
      throw new BadRequestException('Complaint content must be at least 10 characters.');
    }

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

    const complaint = await this.issueRepo.create({
      title: undefined,
      reportedBy: userId,
      reportedByType,
      category: categoryEmbed as any,
      issueContent: complaintContent.trim(),
      rideId: undefined,
    });

    return {
      message: Message(lang, 'ISSUE.CREATED'),
      success: true,
      complaint,
    };
  }

}
