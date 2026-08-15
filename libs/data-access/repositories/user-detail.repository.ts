import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';
import { UserDetails, UserDetailsDocument } from '../entities/user-details.entity';
import { Types } from 'mongoose';
import { DriverOnlineStatus } from '../enums/user.enum';
import { GeoLocationInput } from '../dtos/input/geo-location.input';

@Injectable()
export class UserDetailsRepository extends BaseRepository<UserDetailsDocument> {
    constructor(@InjectModel(UserDetails.name) private readonly _model: BaseModel<UserDetailsDocument>) {
        super(_model);
    }
    findByEmail(email: string) {
        return this.model.findOne({ email });
    }

    async setOnlineStatus(userId: string, driverOnlineStatus: DriverOnlineStatus, locationChannelId?: string,location?: GeoLocationInput): Promise<UserDetailsDocument | null> {
  const update: Record<string, any> = { driverOnlineStatus };
  if (locationChannelId !== undefined) {
    update.locationChannelId = locationChannelId;
  }
  if (location) {
    update.geoLocation = location;
  }
  // Keep the location-update timestamp in sync with the online status.
  // - When coming online, seed it so the 15-min inactivity window starts now.
  // - When going offline, clear it (no active location stream).
  if (driverOnlineStatus === DriverOnlineStatus.ONLINE) {
    update.lastLocationUpdateAt = new Date();
  } else if (driverOnlineStatus === DriverOnlineStatus.OFFLINE) {
    update.lastLocationUpdateAt = null;
  }
  return this.model.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { $set: update },
    { new: true },
  );
}

}
