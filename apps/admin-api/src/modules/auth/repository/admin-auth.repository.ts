// libs/data-access/src/repositories/admin-verification.repository.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AdminVerification, AdminVerificationDocument } from "../entities/admin-verification.entity";
import { BaseRepository } from "../base/base.repository";
import { userVerificationModel } from "@libs/data-access";

@Injectable()
export class AdminVerificationRepository extends BaseRepository<AdminVerificationDocument> {
  constructor(
    @InjectModel(AdminVerification.name)
    private readonly adminVerificationModel: Model<AdminVerificationDocument>,
  ) {
    super(userVerificationModel);
  }
}