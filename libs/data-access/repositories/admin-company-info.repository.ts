import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import {
  AdminCompanyInfo,
  AdminCompanyInfoDocument,
} from "../entities/admin-company-info.entity";

@Injectable()
export class AdminCompanyInfoRepository extends BaseRepository<AdminCompanyInfoDocument> {
  constructor(
    @InjectModel(AdminCompanyInfo.name)
    private readonly _model: BaseModel<AdminCompanyInfoDocument>,
  ) {
    super(_model);
  }

  async findFirst(): Promise<AdminCompanyInfoDocument | null> {
    return this._model.findOne().sort({ createdAt: -1 }).exec();
  }

  async upsert(data: Partial<AdminCompanyInfo>): Promise<AdminCompanyInfoDocument> {
    const existing = await this._model.findOne().exec();
    if (existing) {
      return this._model
        .findByIdAndUpdate(existing._id, { $set: data }, { new: true })
        .exec();
    }
    return this._model.create(data);
  }
}