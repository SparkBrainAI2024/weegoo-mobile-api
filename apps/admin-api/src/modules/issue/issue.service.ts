import { Types } from "mongoose";
// service/issue.service.ts
import {
  BulkResolveIssuesResponse,
  CloseIssueResponse,
  Issue,
  IssueDetailResponse,
  IssueListResponse,
  ResolveIssueResponse,
} from "@libs/data-access";
import { IssueListInput } from "@libs/data-access/dtos/input/issue.list.input";
import { IssueRepository } from "@libs/data-access/repositories/issue.repository";
import { Injectable, NotFoundException } from "@nestjs/common";

type PopulatedRide = {
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
};

function formatMinutes(minutes: number | null): string | undefined {
  if (minutes === null || Number.isNaN(minutes)) return undefined;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

type PopulatedIssue = Omit<Issue, "rideId"> & {
  rideId: PopulatedRide;
  displayId: string;
  reportedBy: {
    _id: Types.ObjectId;
    email: string;
    phone: string;
    suspended: boolean;
    displayId?: string;
    userDetails: {
      fullName: string;
      displayIdAsDriver: string;
      displayIdAsPassenger: string;
    };
  };
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
      : null;

    const reporter: IssuePerson = {
      role: isDriverReporter ? "DRIVER" : "PASSENGER",
      fullName: reporterUser?.userDetails?.fullName ?? null,
      phone: reporterUser?.phone ?? null,
      displayId: isDriverReporter
        ? reporterUser?.userDetails?.displayIdAsDriver
        : (reporteeUser?.userDetails?.displayIdAsPassenger ?? null),
      userId: reporterUser?._id?.toString() ?? null,
      suspended: reporterUser?.suspended ?? false,
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
        }
      : {
          role: "ADMIN",
          fullName: "System Admin",
          phone: null,
          displayId: "Admin",
          userId: null,
          suspended: false,
        };

    return {
      id: issue._id.toString(),
      status: issue.status,
      priority: issue.priority,
      createdAt: issue.createdAt,
      issueContent: issue.issueContent,
      reporter,
      reportee,
      rideId: {
        id: issue.rideId._id.toString(),
        rideUUId: issue.rideId.rideUUId,
      },
      ticketCode: issue.displayId ?? "",
      categoryLabel:
        issue.category?.subCategoryLabel ??
        issue.category?.parentCategory ??
        null,
    };
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
