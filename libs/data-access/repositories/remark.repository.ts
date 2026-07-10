import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import { PaginationInput } from "../base/base.input";
import { IPaginatedResult } from "../interfaces/pagination.interface";
import { Remark, RemarkDocument } from "../entities/remark.entity";

@Injectable()
export class RemarkRepository extends BaseRepository<RemarkDocument> {
  constructor(
    @InjectModel(Remark.name)
    private readonly _model: BaseModel<RemarkDocument>,
  ) {
    super(_model);
  }

  async createRemark(data: Partial<RemarkDocument>): Promise<RemarkDocument> {
    return this._model.create(data);
  }

  async listRemarks(
    paginationInput: PaginationInput,
    filter: any = {},
  ): Promise<IPaginatedResult<RemarkDocument>> {
    return this.paginate(paginationInput, [], filter);
  }
}
