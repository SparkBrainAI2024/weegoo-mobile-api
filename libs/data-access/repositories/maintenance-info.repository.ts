import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import {
  MaintenanceInfo,
  MaintenanceInfoDocument,
} from "../entities/maintenance-info.entity";

@Injectable()
export class MaintenanceInfoRepository extends BaseRepository<MaintenanceInfoDocument> {
  constructor(
    @InjectModel(MaintenanceInfo.name)
    private readonly _model: BaseModel<MaintenanceInfoDocument>,
  ) {
    super(_model);
  }

  async findFirst(): Promise<MaintenanceInfoDocument | null> {
    return this._model.findOne().sort({ createdAt: -1 }).exec();
  }

  async upsert(data: Partial<MaintenanceInfo>): Promise<MaintenanceInfoDocument> {
    const existing = await this._model.findOne().exec();
    if (existing) {
      return this._model
        .findByIdAndUpdate(existing._id, { $set: data }, { new: true })
        .exec();
    }
    return this._model.create(data);
  }
}