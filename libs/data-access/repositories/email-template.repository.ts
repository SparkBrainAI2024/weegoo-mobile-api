import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import { EmailTemplate, EmailTemplateDocument } from "../entities/email-template.entity";
import { ErrorException } from "@libs/common";
import { IPaginatedResult } from "../interfaces/pagination.interface";
import { PipelineStage } from "mongoose";

@Injectable()
export class EmailTemplateRepository extends BaseRepository<EmailTemplateDocument> {
  constructor(
    @InjectModel(EmailTemplate.name) private readonly _model: BaseModel<EmailTemplateDocument>,
  ) {
    super(_model);
  }

  get searchKeys(): string[] {
    return ["title", "slug"];
  }

  async findBySlug(slug: string): Promise<EmailTemplateDocument | null> {
    return this.model.findOne({ slug, deleted: false });
  }

  async findByStatus(status: string): Promise<EmailTemplateDocument[]> {
    return this.model.find({ status, deleted: false });
  }
}