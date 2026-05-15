import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';
import { Types } from 'mongoose';
import { ErrorException } from '@libs/common/exceptions';
import { UserTokenMeta, UserTokenMetaDocument } from '../entities/user-token-meta.entity';
import { toMongoId } from '@libs/common';

@Injectable()
export class UserTokenMetaRepository extends BaseRepository<UserTokenMetaDocument> {
  constructor(
    @InjectModel(UserTokenMeta.name)
    private readonly _model: BaseModel<UserTokenMetaDocument>,
  ) {
    super(_model);
  }

  async findByRefreshTokenJti(refreshTokenJti: string) {
    return this.model.findOne({ refreshTokenJti });
  }

  async findByAccessTokenJti(accessTokenJti: string) {
    return this.model.findOne({ accessTokenJti });
  }

  async deleteByUserAndDevice(userId: string, deviceId: string) {
    try {
      return await this.model.deleteMany({ userId: toMongoId(userId), deviceId });
    } catch (e) {
      ErrorException(e, 'COMMON.INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async deleteByUser(userId: string) {
    try {
      return await this.model.deleteMany({ userId: toMongoId(userId) });
    } catch (e) {
      ErrorException(e, 'COMMON.INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async deleteByRefreshTokenJti(refreshTokenJti: string) {
    try {
      return await this.model.deleteOne({ refreshTokenJti });
    } catch (e) {
      ErrorException(e, 'COMMON.INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteByAccessTokenJti(accessTokenJti: string) {
    try {
      return await this.model.deleteOne({ accessTokenJti });
    } catch (e) {
      ErrorException(e, 'COMMON.INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createSessionMeta(
    userId: Types.ObjectId,
    deviceId: string,
    accessTokenJti: string,
    refreshTokenJti: string,
    email: string,
    role?:string
  ) {
    try {
      await this.model.findOneAndDelete({ userId, deviceId });
      return await this.create({
        userId,
        deviceId,
        accessTokenJti,
        refreshTokenJti,
        email,
        role: role || 'USER',
      });
    } catch (e) {
      ErrorException(e, 'COMMON.INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
