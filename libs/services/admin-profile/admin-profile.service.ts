import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorException } from "@libs/common";
import { comparePassword, hashPassword } from "@libs/common/utils/bcrypt";
import { passwordSalt } from "@libs/common/constants";
import { Message } from "@libs/localization";
import { AdminUserRepository } from "@libs/data-access/repositories/admin-user.repository";
import { AdminUserDocument } from "@libs/data-access/entities/admin-user.entity";
import { AdminProfileResponse } from "@libs/data-access/dtos/response/admin-profile.response";
import { Types } from "mongoose";
import {
  ChangeAdminPasswordInput,
  UpdateAdminProfileInput,
} from "@libs/data-access/dtos/input/update-admin-profile.input";
import { BasicResponse } from "@libs/data-access";
// plus imports for AdminUserDocument, the DTOs above

@Injectable()
export class AdminProfileService {
  constructor(private readonly adminUserRepository: AdminUserRepository) {}

  private toResponse(admin: AdminUserDocument): AdminProfileResponse {
    return {
      _id: admin._id.toString(),
      fullName: admin.fullName,
      email: admin.email,
      phone: admin.phone ?? null,
    };
  }

  getProfile(admin: AdminUserDocument): AdminProfileResponse {
    return this.toResponse(admin); // the guard already loaded it
  }

  async updateProfile(
    adminId: Types.ObjectId,
    input: UpdateAdminProfileInput,
  ): Promise<AdminProfileResponse> {
    // ASSUMED repository method: use whatever your base repository calls "find one and update"
    const updated = await this.adminUserRepository.findOneAndUpdate(
      { _id: adminId },
      { fullName: input.fullName, phone: input.phone ?? null },
    );
    if (!updated)
      ErrorException(null, "COMMON.USER_NOT_FOUND", HttpStatus.NOT_FOUND);
    return this.toResponse(updated);
  }

  async changePassword(
    admin: AdminUserDocument,
    input: ChangeAdminPasswordInput,
    lang: string,
  ): Promise<BasicResponse> {
    const matches = await comparePassword(
      input.currentPassword,
      admin.password,
    );
    if (!matches)
      ErrorException(
        null,
        "ADMIN_USER.INVALID_CURRENT_PASSWORD",
        HttpStatus.BAD_REQUEST,
      ); // 400, not 401

    if (input.currentPassword === input.newPassword) {
      ErrorException(
        null,
        "ADMIN_USER.PASSWORD_UNCHANGED",
        HttpStatus.BAD_REQUEST,
      );
    }

    const hashed = await hashPassword(input.newPassword, passwordSalt);
    await this.adminUserRepository.findOneAndUpdate(
      { _id: admin._id },
      { password: hashed },
    );

    return {
      message: Message(lang, "ADMIN_USER.PASSWORD_CHANGED"),
      success: true,
    };
  }
}
