import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Issue, IssueDocument } from '../entities/issue.entity';
import {  IssueStatus, ReportedByType } from '@libs/data-access/enums/issue.enum';
import { IssueCategory } from '../entities/issue-category.entity';
import { CreateIssueInput } from '../dtos/input/create-issue.input';
import { IssueCategoryEmbed } from '../entities/issue-category.embedded';



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
    @InjectModel(IssueCategory.name) private readonly issueCategoryEmbed: Model<IssueCategory>,
  ) {}

  async create(data: CreateIssueInput & { category: IssueCategoryEmbed; reportedBy: string; reportedByType: ReportedByType }): Promise<Issue> {
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

  async findIssueCategoryById(id: string): Promise<IssueCategory | null> {
  return this.issueCategoryEmbed.findById(id).lean();
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

async seedIssueCategorys(data: Partial<IssueCategory>[]) {
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
}