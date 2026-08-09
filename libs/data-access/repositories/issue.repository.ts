import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage, Types } from "mongoose";
import { Issue, IssueDocument } from "../entities/issue.entity";
import {
  CategoryAccessedByRole,
  IssueCategoryForRole,
  IssueParentCategory,
  IssueStatus,
  ReportedByType,
} from "@libs/data-access/enums/issue.enum";
import { IssueCategory } from "../entities/issue-category.entity";
import { CreateIssueInput } from "../dtos/input/create-issue.input";
import { IssueCategoryEmbed } from "../entities/issue-category.embedded";
import { IssueListInput } from "../dtos/input/issue.list.input";
import { toMongoId } from "@libs/common";

export interface IssueFilters {
  status?: IssueStatus;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

@Injectable()
export class IssueRepository {
  constructor(
    @InjectModel(Issue.name)
    private readonly model: Model<IssueDocument>,
    @InjectModel(IssueCategory.name)
    private readonly issueCategoryEmbed: Model<IssueCategory>,
  ) {}

  async create(
    data: CreateIssueInput & {
      category: IssueCategoryEmbed;
      reportedBy: string;
      reportedByType: ReportedByType;
    },
  ): Promise<Issue> {
    return this.model.create({
      data,
      reportedBy: toMongoId(data.reportedBy),
      rideId: toMongoId(data.rideId),
    });
  }

  // admin sees all with optional filters
  async findAll(
    filters: IssueFilters,
    options: PaginationOptions,
  ): Promise<{ items: Issue[]; total: number }> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (filters.status) query.status = filters.status;

    const [items, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.model.countDocuments(query),
    ]);

    return { items, total };
  }

  async findById(issueId: string): Promise<Issue | null> {
    return this.model.findById(issueId);
  }

  async findIssueCategoryById(id: string): Promise<IssueCategory | null> {
    return this.issueCategoryEmbed.findById(id).lean();
  }

  async updateStatus(
    issueId: string,
    status: IssueStatus,
  ): Promise<Issue | null> {
    return this.model.findByIdAndUpdate(issueId, { status }, { new: true });
  }

  async resolve(issueId: string, adminId: string): Promise<Issue | null> {
    return this.model.findByIdAndUpdate(
      issueId,
      {
        status: IssueStatus.RESOLVED,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      },
      { new: true },
    );
  }

  async findByParentCategory(
    parentCategory: IssueParentCategory,
    categoryAccessedByRole: CategoryAccessedByRole,
  ): Promise<IssueCategory[]> {
    return this.issueCategoryEmbed
      .find({
        parentCategory,
        isActive: true,
        categoryForRole: {
          $in: [categoryAccessedByRole, IssueCategoryForRole.BOTH],
        }, // ← filter by role
      })
      .sort({ sortOrder: 1 })
      .lean();
  }

  async seedIssueCategories(data: Partial<IssueCategory>[]) {
    await Promise.all(
      data.map((item) =>
        this.issueCategoryEmbed.updateOne(
          {
            parentCategory: item.parentCategory,
            label: item.label,
          },
          {
            $set: item,
          },
          {
            upsert: true,
          },
        ),
      ),
    );
  }

  /**
   * Mirrors getDriverList's shape: one aggregation, three facets — paginated rows,
   * total count for pagination, and a status breakdown for the stat cards.
   *
   * CONFIRMED: users -> "users" collection, AdminUser -> "adminusers" collection,
   * category display uses subCategoryLabel with parentCategory as fallback.
   */
  async getIssueList(input: IssueListInput) {
    const page = input.page ?? 0;
    const limit = input.limit ?? 10;

    const match: Record<string, any> = { deleted: { $ne: true } };

    if (input.reportedByType) match.reportedByType = input.reportedByType;
    if (input.priority) match.priority = input.priority;
    // category filter matches either the sub-category label (e.g. "Payment") or,
    // for issues with no sub-category, the parent category enum value directly
    if (input.category) {
      match.$or = [{ "category.parentCategory": input.category }];
    }

    if (input.unassignedOnly) {
      match.assignedTo = null;
    } else if (input.assignedTo) {
      match.assignedTo = new Types.ObjectId(input.assignedTo);
    }

    if (input.dateFrom || input.dateTo) {
      match.createdAt = {};
      if (input.dateFrom) match.createdAt.$gte = new Date(input.dateFrom);
      if (input.dateTo) {
        // inclusive end-of-day
        const end = new Date(input.dateTo);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    const commonPipeline: PipelineStage[] = [
      { $match: match },

      {
        $lookup: {
          from: "users",
          localField: "reportedBy",
          foreignField: "_id",
          as: "reporter",
        },
      },
      { $unwind: { path: "$reporter", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "userdetails",
          localField: "reportedBy",
          foreignField: "userId",
          as: "reporterDetails",
        },
      },
      {
        $unwind: { path: "$reporterDetails", preserveNullAndEmptyArrays: true },
      },

      {
        $lookup: {
          from: "adminusers",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignee",
        },
      },
      { $unwind: { path: "$assignee", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "rides",
          localField: "rideId",
          foreignField: "_id",
          as: "rideDetails",
        },
      },
      { $unwind: { path: "$rideDetails", preserveNullAndEmptyArrays: true } },

      ...(input.search
        ? [
            {
              $match: {
                $or: [
                  {
                    "reporterDetails.fullName": {
                      $regex: input.search,
                      $options: "i",
                    },
                  },
                  { rideId: { $regex: input.search, $options: "i" } },
                ],
              },
            } as PipelineStage,
          ]
        : []),
    ];

    // status filter applies only inside the row facet, not the count facets,
    // so the stat cards keep showing totals across all statuses (like the
    // driver list keeps statusCounts un-filtered by its own status param)
    const statusFilterStage: PipelineStage.FacetPipelineStage[] = input.status
      ? [{ $match: { status: input.status } }]
      : [];

    const [result] = await this.model.aggregate([
      ...commonPipeline,
      {
        $facet: {
          paginatedResults: [
            ...statusFilterStage,
            {
              $project: {
                id: "$_id",
                // TODO: replace with a real sequential ticket number field once you add one;
                // this derives a stable-looking code from the Mongo id for now
                ticketCode: {
                  $concat: [
                    "REP-",
                    { $substrCP: [{ $toString: "$_id" }, 18, 6] },
                  ],
                },
                createdAt: 1,
                reportedByName: {
                  $ifNull: ["$reporterDetails.fullName", "Unknown"],
                },
                reportedByType: 1,
                rideId: "$rideDetails.rideUUId",
                categoryLabel: "$category.parentCategory",
                status: 1,
                priority: 1,
                assigneeName: "$assignee.fullName",
              },
            },
            { $sort: { createdAt: -1 } },
            { $skip: page * limit },
            { $limit: limit },
          ] as PipelineStage.FacetPipelineStage[],

          totalCount: [
            ...statusFilterStage,
            { $count: "count" },
          ] as PipelineStage.FacetPipelineStage[],

          statusCounts: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ] as PipelineStage.FacetPipelineStage[],

          resolutionTimes: [
            {
              $match: {
                status: IssueStatus.RESOLVED,
                resolvedAt: { $ne: null },
              },
            },
            {
              $project: {
                minutes: {
                  $divide: [
                    { $subtract: ["$resolvedAt", "$createdAt"] },
                    60000,
                  ],
                },
              },
            },
            { $group: { _id: null, avgMinutes: { $avg: "$minutes" } } },
          ] as PipelineStage.FacetPipelineStage[],
        },
      },
    ]);

    const total = result.totalCount[0]?.count ?? 0;
    const counts = Object.fromEntries(
      result.statusCounts.map((s: any) => [s._id, s.count]),
    );
    const avgResolutionMinutes = result.resolutionTimes[0]?.avgMinutes ?? null;

    return {
      items: result.paginatedResults,
      pagination: {
        total,
        page,
        limit,
        hasNextPage: (page + 1) * limit < total,
        hasPreviousPage: page > 0,
      },
      totalOpen: counts[IssueStatus.OPEN] ?? 0,
      totalInReview: counts[IssueStatus.IN_REVIEW] ?? 0,
      totalResolved: counts[IssueStatus.RESOLVED] ?? 0,
      avgResolutionMinutes,
    };
  }

  async resolveOne(id: string, resolvedBy: string) {
    return this.model.findByIdAndUpdate(
      id,
      { status: IssueStatus.RESOLVED, resolvedAt: new Date(), resolvedBy },
      { new: true },
    );
  }

  async closeOne(id: string, closedBy: string) {
    // Deliberately doesn't check current status — a ticket can be closed
    // directly (e.g. duplicate/invalid) without ever passing through RESOLVED
    return this.model.findByIdAndUpdate(
      id,
      { status: IssueStatus.CLOSED, closedAt: new Date(), closedBy },
      { new: true },
    );
  }

  async resolveMany(ids: string[], resolvedBy: string): Promise<number> {
    const result = await this.model.updateMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
      { status: IssueStatus.RESOLVED, resolvedAt: new Date(), resolvedBy },
    );
    return result.modifiedCount ?? 0;
  }
}
