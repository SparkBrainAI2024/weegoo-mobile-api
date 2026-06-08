import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';
import { UserDailyOnlineStatus, UserDailyOnlineStatusDocument } from '../entities/user-daily-online-status.entity';

@Injectable()
export class UserDailyOnlineStatusRepository extends BaseRepository<UserDailyOnlineStatusDocument> {
  constructor(
    @InjectModel(UserDailyOnlineStatus.name)
    private readonly _model: BaseModel<UserDailyOnlineStatusDocument>,
  ) {
    super(_model);
  }
}