// libs/data-access/src/repositories/admin-user.repository.ts
import { BaseModel, BaseRepository } from "@libs/data-access";
import { AdminUser, AdminUserDocument } from "@libs/data-access/entities/admin-user.entity";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";


@Injectable()
export class AdminUserRepository extends BaseRepository<AdminUserDocument> {
  constructor(
    @InjectModel(AdminUser.name)
    private readonly _adminUserModel: BaseModel<AdminUserDocument>,
  ) {
    super(_adminUserModel);
  }
}