import { Types } from "mongoose";
// service/issue.service.ts
import {
  BulkResolveIssuesResponse,
  CloseIssueResponse,
  HighPriorityIssuesResponse,
  Issue,
  IssueDetailResponse,
  IssueListResponse,
  IssueStatus,
  ResolveIssueResponse,
} from "@libs/data-access";
import { IssueListInput } from "@libs/data-access/dtos/input/issue.list.input";
import { IssueRepository } from "@libs/data-access/repositories/issue.repository";
import { Injectable, NotFoundException } from "@nestjs/common";
import { UserProfileImageEntity } from "@libs/data-access/common/user-profile-image";
import { Message } from "@libs/localization";

export type PopulatedReportedBy = {
  _id: Types.ObjectId;
  email: string;
  phone: string;
  suspended: boolean;
  userDetails: {
    fullName: string;
    displayIdAsPassenger: string;
    displayIdAsDriver: string;
    profileImages: UserProfileImageEntity[];
  };
};
export type PopulatedRide = {
  _id: Types.ObjectId;
  rideUUId: string;
  passengerId: {
    _id: Types.ObjectId;
    email: string;
    phone: string;
    suspended: boolean;
    userDetails: {
      fullName: string;
      displayIdAsPassenger: string;
      displayIdAsDriver: string;
      profileImages: UserProfileImageEntity[];
    };
  };

  driverId: {
    _id: Types.ObjectId;
    email: string;
    phone: string;
    suspended: boolean;
    userDetails: {
      fullName: string;
      displayIdAsDriver: string;
      displayIdAsPassenger: string;
      profileImages: UserProfileImageEntity[];
    };
  };
};

type IssuePerson = {
  role: string;
  fullName: string | null;
  phone: string | null;
  displayId: string | null;
  userId: string | null;
  suspended: boolean;
  profileImage?: string;
};

function formatMinutes(minutes: number | null): string | undefined {
  if (minutes === null || Number.isNaN(minutes)) return undefined;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

export type PopulatedIssue = Omit<Issue, "rideId" | "reportedBy"> & {
  rideId: PopulatedRide;
  displayId: string;
  reportedBy: PopulatedReportedBy;
};

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

  /**
   * Fetches the top N issues for the admin dashboard using cascading
   * priority fill. Defaults to 5 issues:
   *
   *  1. HIGH-priority issues first (oldest first)
   *  2. If fewer than `limit` HIGH issues exist, the remainder is filled
   *     with MEDIUM-priority issues (oldest first)
   *  3. If still fewer than `limit`, the remainder is filled with
   *     LOW-priority issues (oldest first)
   *
   * Only open / in-review issues are considered (not resolved/closed).
   */
  async getHighPriorityIssues(limit = 5): Promise<HighPriorityIssuesResponse> {
    const items = await this.issueRepository.getHighPriorityIssues(limit);
    return {
      items,
      total: items.length,
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

  async getIssueDetail(id: string): Promise<IssueDetailResponse> {
    const issue = (await this.issueRepository.findById(id)) as PopulatedIssue;
    const isRideIssue = issue.category?.parentCategory === "RIDE";
    const isDriverReporter = issue.reportedByType === "DRIVER";

    const reporterUser = isRideIssue
      ? isDriverReporter
        ? issue.rideId.driverId
        : issue.rideId.passengerId
      : issue.reportedBy;

    const reporteeUser = isRideIssue
      ? isDriverReporter
        ? issue.rideId.passengerId
        : issue.rideId.driverId
          ? issue.rideId.driverId
          : null
      : null;

    const reporter: IssuePerson = {
      role: isDriverReporter ? "DRIVER" : "PASSENGER",
      fullName: reporterUser?.userDetails?.fullName ?? null,
      phone: reporterUser?.phone ?? null,
      displayId: isDriverReporter
        ? reporterUser?.userDetails?.displayIdAsDriver
        : (reporterUser?.userDetails?.displayIdAsPassenger ?? null),
      userId: reporterUser?._id?.toString() ?? null,
      suspended: reporterUser?.suspended ?? false,
      profileImage:
        reporterUser?.userDetails?.profileImages?.[0].socialPicture ?? "",
    };

    const reportee: IssuePerson = reporteeUser
      ? {
          role: isDriverReporter ? "PASSENGER" : "DRIVER",
          fullName: reporteeUser?.userDetails?.fullName ?? null,
          phone: reporteeUser?.phone ?? null,
          displayId: isDriverReporter
            ? reporteeUser?.userDetails?.displayIdAsPassenger
            : (reporteeUser?.userDetails?.displayIdAsDriver ?? null),
          userId: reporteeUser?._id?.toString() ?? null,
          suspended: reporteeUser?.suspended ?? false,
          profileImage:
            reporteeUser?.userDetails?.profileImages?.[0].socialPicture ?? "",
        }
      : {
          role: "ADMIN",
          fullName: "System Admin",
          phone: null,
          displayId: "Admin",
          userId: null,
          suspended: false,
        };

    const issueResponse = {
      id: issue._id.toString(),
      status: issue.status,
      priority: issue.priority,
      createdAt: issue.createdAt,
      issueContent: issue.issueContent,
      reporter,
      reportee,
      rideId: issue?.rideId
        ? {
            id: issue.rideId._id.toString(),
            rideUUId: issue.rideId.rideUUId,
          }
        : null,
      ticketCode: issue.displayId ?? "",
      categoryLabel: issue.category?.subCategoryLabel ?? null,
      issueCategoryType: issue.category.parentCategory,
    };
    return issueResponse;
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

  async updateIssueStatus(id: string, status: IssueStatus, lang: string) {
    const issueUpdated = await this.issueRepository.updateStatus(id, status);
    return {
      message: Message(lang, "ISSUE.UPDATED"),
      success: true,
      issue: issueUpdated,
    };
  }
}
