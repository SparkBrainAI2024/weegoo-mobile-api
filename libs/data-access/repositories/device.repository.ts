import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';;
import { Device, DeviceDocument } from '../entities/device.entity';
import { Types } from 'mongoose';
import { ErrorException } from '@libs/common';

@Injectable()
export class DeviceRepository extends BaseRepository<DeviceDocument> {
  constructor(@InjectModel(Device.name) private readonly _model: BaseModel<DeviceDocument>) {
    super(_model);
  }
 async findByUserId(userId: string) {
    return await this.model.findOne({ userId });
  }

  async findByDeviceId(deviceId: string) {
    return await this.model.findOne({ deviceId });
  }

  async addDevice(
    userId: Types.ObjectId,
    deviceId: string,
    firebaseToken: string,
    deviceType: string | null
  ) {
    return await this.model.create({
      userId,
      deviceId,
      firebaseToken,
      deviceType,
    });
  }

  async logout(userId: string, deviceId: string) {
    const device = await this.model.findOne({ userId, deviceId });
    if (!device)
      ErrorException(null, "USER.DEVICE_NOT_FOUND", HttpStatus.BAD_REQUEST);
    return this.model.deleteOne({ userId, deviceId });
  }
}
