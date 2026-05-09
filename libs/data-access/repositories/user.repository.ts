import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';
import { User, UserDocument } from '../entities/user.entity';
import { ErrorException } from '@libs/common';

@Injectable()
export class UserRepository extends BaseRepository<UserDocument> {
  constructor(@InjectModel(User.name) private readonly _model: BaseModel<UserDocument>) {
    super(_model);
  }
  findByEmail(email: string) {
    return this.model.findOne({ email });
  }

  findByPhone(phone: string) {
    return this.model.findOne({ phone });
  }

  userCounts() {
    try {
      return this.model.countDocuments()
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}
