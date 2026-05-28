// libs/data-access/src/repositories/admin-user.repository.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AdminUser, AdminUserDocument } from "../entities/admin-user.entity";
import { BaseRepository } from "../base/base.repository";

@Injectable()
export class AdminUserRepository extends BaseRepository<AdminUserDocument> {
  constructor(
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
  ) {
    super(adminUserModel);
  }
}