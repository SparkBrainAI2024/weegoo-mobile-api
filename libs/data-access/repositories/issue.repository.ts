import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Issue, IssueDocument } from '../entities/issue.entity';
import { IssueCategory, IssueStatus, ReportedByType } from '@libs/data-access/enums/issue.enum';

export interface CreateIssueDto {
  reportedBy: string;
  reportedByType: ReportedByType;
  rideId?: string;
  category: IssueCategory;
  issueContent: string;
}

export interface IssueFilters {
  status?: IssueStatus;
  category?: IssueCategory;
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
  ) {}

  async create(data: CreateIssueDto): Promise<Issue> {
    return this.model.create(data);
  }

  // passenger or driver sees only their own issues
  async findByReportedBy(
    userId: string,
    options: PaginationOptions,
  ): Promise<{ items: Issue[]; total: number }> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model
        .find({ reportedBy: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.model.countDocuments({ reportedBy: userId }),
    ]);

    return { items, total };
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
    if (filters.category) query.category = filters.category;

    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(query),
    ]);

    return { items, total };
  }

  async findById(issueId: string): Promise<Issue | null> {
    return this.model.findById(issueId);
  }

  async updateStatus(issueId: string, status: IssueStatus): Promise<Issue | null> {
    return this.model.findByIdAndUpdate(
      issueId,
      { status },
      { new: true },
    );
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
}