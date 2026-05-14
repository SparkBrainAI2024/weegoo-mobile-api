import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { ErrorException } from "@libs/common";
import { VehicleRepository } from "./repository/vehicle.repository";
import { RegisterVehicleInput } from "./input/create-vehicle.input";
import { Message } from "@libs/localization";
import { ImageStatus } from "@libs/data-access/enums/upload.enum";
import { UpdateVehicleImageInput } from "./input/update-vehicle-image.input";
import { Vehicle } from "./entities/vehicle.entity";
import { S3Service } from "@libs/s3/s3.service";


@Injectable()
export class VehicleService {
  private readonly logger = new Logger(VehicleService.name);
  constructor(private readonly vehicleRepository: VehicleRepository,    private readonly s3: S3Service,
) {}

  async registerVehicle(driverId: string, input: RegisterVehicleInput, lang: string) {
    try {
      const existing = await this.vehicleRepository.findByNumberPlate(input.numberPlate);
      if (existing) {
        ErrorException(null, "VEHICLE.NUMBER_PLATE_ALREADY_EXISTS", HttpStatus.BAD_REQUEST);
      }
      const images = input.imageS3Key
      ? [{ s3Key: input.imageS3Key, status: ImageStatus.ACTIVE, createdAt: new Date() }]
      : [];


      const vehicle = await this.vehicleRepository.create({
        ...input,
        driverId: new Types.ObjectId(driverId),
        images,
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

   async updateVehicleImage(
    driverId: string,
    input: UpdateVehicleImageInput,
    lang: string,
  ) {
    try {
      const vehicle = await this.vehicleRepository.findOne({
        _id: new Types.ObjectId(input.vehicleId),
        driverId: new Types.ObjectId(driverId),
      });

      if (!vehicle) {
        ErrorException(
          null,
          "VEHICLE.NOT_FOUND",
          HttpStatus.NOT_FOUND,
        );
      }

      // Mark old ACTIVE images as INACTIVE
      vehicle.images = vehicle.images.map((img) =>
        img.status === ImageStatus.ACTIVE
          ? {
              ...img,
              status: ImageStatus.INACTIVE,
            }
          : img,
      );

      // Add new ACTIVE image
      vehicle.images.push({
        s3Key: input.s3Key,
        status: ImageStatus.ACTIVE,
        createdAt: new Date(),
      });

      await vehicle.save();

      return {
        success: true,
        message: Message(lang, "VEHICLE.IMAGE_UPDATED"),
        vehicle,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
    // ─── Get vehicles by driver ───────────────────────────────────────────────────
  async getVehiclesByDriver(driverId: string, lang: string) {
    try {
      const vehicles = await this.vehicleRepository.find({
        driverId: new Types.ObjectId(driverId),
      });

      return {
        success: true,
        message: Message(lang, "VEHICLE.LIST_FETCHED"),
        vehicles,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─── Active image URL helper ──────────────────────────────────────────────────
  getActiveImageUrl(vehicle: Vehicle): string | null {
    const active = vehicle.images.find(
      (img) => img.status === ImageStatus.ACTIVE,
    );

    return active
      ? this.s3.buildObjectUrl(active.s3Key)
      : null;
  }

  // ─── Delete inactive images (cron) ────────────────────────────────────────────
  async deleteInactiveImages(): Promise<void> {
    try {
      const vehicles = await this.vehicleRepository.find({
        "images.status": ImageStatus.INACTIVE,
      });

      for (const vehicle of vehicles) {
        const inactiveImages = vehicle.images.filter(
          (img) => img.status === ImageStatus.INACTIVE,
        );

        // Delete from S3
        for (const img of inactiveImages) {
          try {
            await this.s3.deleteObject(img.s3Key);
          } catch (e) {
            this.logger.error(
              `Failed to delete S3 key: ${img.s3Key}`,
              e,
            );
          }
        }

        // Keep only ACTIVE images
        vehicle.images = vehicle.images.filter(
          (img) => img.status === ImageStatus.ACTIVE,
        );

        await vehicle.save();
      }
    } catch (e) {
      this.logger.error("Failed to delete inactive images", e);
    }
  }

}