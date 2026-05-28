// libs/data-access/src/repositories/admin-verification.repository.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { BaseModel, BaseRepository, UserVerification, UserVerificationDocument,  } from "@libs/data-access";

@Injectable()
export class AdminVerificationRepository extends BaseRepository<UserVerificationDocument> {
  constructor(
    @InjectModel(UserVerification.name)
    private readonly _model: BaseModel<UserVerificationDocument>,
  ) {
    super(_model);
  }
}

