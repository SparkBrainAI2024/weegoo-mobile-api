import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "../base/base.model";
import { BaseRepository } from "../base/base.repository";
import {
  AdminRidePricing,
  AdminRidePricingDocument,
} from "../entities/admin-ride-pricing.entity";
import { VehicleType } from "../enums/vehicle.enum";

@Injectable()
export class AdminRidePricingRepository extends BaseRepository<AdminRidePricingDocument> {
  constructor(
    @InjectModel(AdminRidePricing.name)
    private readonly _model: BaseModel<AdminRidePricingDocument>,
  ) {
    super(_model);
  }

  async findByVehicleType(
    vehicleType: VehicleType,
  ): Promise<AdminRidePricingDocument | null> {
    return this._model.findOne({ vehicleType }).exec();
  }

  async findAllPricing(): Promise<AdminRidePricingDocument[]> {
    return this._model.find().sort({ vehicleType: 1 }).exec();
  }

  async upsertByVehicleType(
    vehicleType: VehicleType,
    data: Partial<AdminRidePricing>,
  ): Promise<AdminRidePricingDocument> {
    return this._model
      .findOneAndUpdate(
        { vehicleType },
        { $set: data },
        { new: true, upsert: true },
      )
      .exec();
  }
}