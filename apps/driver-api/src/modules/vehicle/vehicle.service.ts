import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { ErrorException } from "@libs/common";
import { VehicleRepository } from "./repository/vehicle.repository";
import { RegisterVehicleInput } from "./input/create-vehicle.input";
import { Message } from "@libs/localization";


@Injectable()
export class VehicleService {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  async registerVehicle(driverId: string, input: RegisterVehicleInput, lang: string) {
    try {
      const existing = await this.vehicleRepository.findByNumberPlate(input.numberPlate);
      if (existing) {
        ErrorException(null, "VEHICLE.NUMBER_PLATE_ALREADY_EXISTS", HttpStatus.BAD_REQUEST);
      }

      const vehicle = await this.vehicleRepository.create({
        ...input,
        driverId: new Types.ObjectId(driverId),
      });

      return {
        message: Message(lang, "VEHICLE.REGISTERED"),
        success: true,
        vehicle,
      };
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}