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
    role?:string,
    firebaseToken?:string
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
        firebaseToken: firebaseToken || null
      });
    } catch (e) {
      ErrorException(e, 'COMMON.INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Finds all distinct user IDs that have firebase tokens and USER role.
   * Used for broadcasting promocode notifications to all users.
   */
  async findDistinctUserIdsWithFirebaseToken(): Promise<string[]> {
    try {
      const result = await this.model.distinct('userId', {
        firebaseToken: { $exists: true, $nin: [null, ''] },
        role: 'USER',
      });
      return result.map((id: Types.ObjectId | string) => id.toString());
    } catch (e) {
      console.error('Error finding distinct user IDs with firebase token:', e);
      return [];
    }
  }

  /**
   * Finds all distinct firebase tokens for the given roles.
   * Used for broadcasting push notifications to targeted user groups.
   */
  async findFirebaseTokensByRoles(roles: string[]): Promise<string[]> {
    try {
      const result = await this.model.distinct('firebaseToken', {
        firebaseToken: { $exists: true, $nin: [null, ''] },
        role: { $in: roles },
      });
      return result.filter((token): token is string => typeof token === 'string');
    } catch (e) {
      console.error('Error finding firebase tokens by roles:', e);
      return [];
    }
  }

  async updateFirebaseToken(userId: Types.ObjectId | string, deviceId: string, firebaseToken: string, deviceType?: string) {
    try {
      const userObjectId = typeof userId === 'string' ? toMongoId(userId) : userId;
      
      // Find existing token meta for this user and device
      const existingToken = await this.model.findOne({ userId: userObjectId, deviceId });
      console.log('Existing token meta:', existingToken);
      if (existingToken) {
        // Update existing token meta with new firebase token
        return await this.model.updateOne(
          { userId: userObjectId, deviceId },
          { 
            firebaseToken,
            deviceType: deviceType || existingToken.deviceType,
          }
        );
      } else {
        // Throw error if user token meta doesn't exist
        console.error('User token meta not found for user ID:', userId);
        ErrorException(null, 'USER.NOT_FOUND', HttpStatus.NOT_FOUND);
      }
    } catch (e) {
      ErrorException(e, 'COMMON.INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async clearFirebaseToken(userId: Types.ObjectId | string, deviceId: string) {
    try {
      const userObjectId = typeof userId === 'string' ? toMongoId(userId) : userId;
      return await this.model.updateOne(
        { userId: userObjectId, deviceId },
        { $unset: { firebaseToken: 1 } }
      );
    } catch (e) {
      ErrorException(e, 'COMMON.INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
