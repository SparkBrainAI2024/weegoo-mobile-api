import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { BaseModel } from "@libs/data-access/base/base.model";
import { BaseRepository } from "@libs/data-access/base/base.repository";
import { Vehicle, VehicleDocument } from "../../../apps/driver-api/src/modules/vehicle/entities/vehicle.entity";
import { Types } from "mongoose";

@Injectable()
export class VehicleRepository extends BaseRepository<VehicleDocument> {
  constructor(@InjectModel(Vehicle.name) private readonly _model: BaseModel<VehicleDocument>) {
    super(_model);
  }

  findByNumberPlate(numberPlate: string) {
    return this.model.findOne({ numberPlate });
  }

  findByDriverId(driverId: string) {
    return this.model.find({ driverId });
  }

  // Optional: explicit create if you want typed partial payload
  createVehicle(doc: Partial<VehicleDocument>) {
    return this.model.create(doc);
  }

  update(vehicleId: Types.ObjectId, update: Partial<VehicleDocument>) {
    return this.model.findByIdAndUpdate(vehicleId, update, { new: true });
  }
}