import { Injectable } from "@nestjs/common";
import { BaseRepository } from "../base/base.repository";
import { InjectModel } from "@nestjs/mongoose";
import { Rides, RidesDocument } from "../entities/rides.entity";
import { BaseModel } from "../base/base.model";

@Injectable()
export class RidesRepository extends BaseRepository<RidesDocument> {
  constructor(@InjectModel(Rides.name) private readonly _model: BaseModel<RidesDocument>) {
    super(_model);
  }
  findAllRidesWithPagination(query:any,input:any) {
    return this.model.findOne({ email:input.email }).exec();
  }
}