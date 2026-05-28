// apps/admin/src/auth/admin-auth.service.ts
import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { ErrorException } from "@libs/common/exceptions";
import { comparePassword, hashPassword } from "@libs/common/utils/bcrypt";
import { isOtpExpired, UTCTime } from "@libs/common/utils/datetime";
import { GenerateRandomDigit } from "@libs/common/utils/id.generator";
import { generateToken } from "@libs/common/utils/jwt";
import { passwordSalt, userOtpExpiredTime, tokenTypes } from "@libs/common/constants";
import { MailService } from "@libs/services/mail";
import { toMongoId } from "@libs/common";
import { AdminUserRepository } from "@libs/data-access/repositories/admin-user.repository";
import { AdminVerificationRepository } from "@libs/data-access/repositories/admin-verification.repository";
import { verificationType } from "@libs/data-access/enums/user.enum";
import {
  AdminForgotPasswordInput,
  AdminVerifyOtpInput,
  AdminUpdatePasswordInput,
  AdminSignInInput,
} from "@libs/data-access/dto/admin-auth.dto";
import { Message } from "@libs/localization";

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    private readonly adminVerificationRepository: AdminVerificationRepository,
    private readonly mailService: MailService,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────

  private async hasValidOtp(adminId: Types.ObjectId): Promise<any> {
    const verification = await this.adminVerificationRepository.findOne({
      adminId,
      type: verificationType.RESET_PASSWORD, // or whatever enum value fits
    });
    if (verification && !isOtpExpired(verification.createdAt, userOtpExpiredTime)) {
      return verification;
    }
    return null;
  }

  // ─── Sign In ────────────────────────────────────────────────

  async signIn(input: AdminSignInInput, lang: string) {
    try {
      const admin = await this.adminUserRepository.findOne({
        email: input.email,
        deleted: false,
      });

      if (!admin) {
        ErrorException(
          new Error(),
          "ADMIN.NOT_FOUND",
          HttpStatus.NOT_FOUND,
        );
      }

      const isMatch = await comparePassword(input.password, admin.password);
      if (!isMatch) {
        ErrorException(
          new Error(),
          "ADMIN.INVALID_CREDENTIALS",
          HttpStatus.UNAUTHORIZED,
        );
      }

      const payload = { _id: admin._id, type: tokenTypes.ACCESS };
      const accessToken = generateToken(payload);
      const refreshToken = generateToken({ ...payload, type: tokenTypes.REFRESH });

      return {
        message: Message("ADMIN.SIGN_IN_SUCCESS", lang),
        accessToken,
        refreshToken,
      };
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ─── Forgot Password → Send OTP ────────────────────────────

  async forgotPassword(input: AdminForgotPasswordInput, lang: string) {
    try {
      const admin = await this.adminUserRepository.findOne({
        email: input.email,
        deleted: false,
      });

      if (!admin) {
        ErrorException(
          new Error(),
          "ADMIN.NOT_FOUND",
          HttpStatus.NOT_FOUND,
        );
      }

      // throttle: if valid OTP already exists, return remaining time
      const existing = await this.hasValidOtp(admin._id);
      if (existing) {
        const elapsed = Math.floor(
          (Date.now() - new Date(existing.createdAt).getTime()) / 1000,
        );
        const remaining = userOtpExpiredTime - elapsed;
        return {
          message: Message("ADMIN.OTP_ALREADY_SENT", lang),
          expiresIn: remaining,
        };
      }

      const otp = GenerateRandomDigit();

      // wipe old record for this admin, create fresh
      await this.adminVerificationRepository.findOneAndDelete({
        adminId: admin._id,
        type: verificationType.RESET_PASSWORD,
      });

      await this.adminVerificationRepository.create({
        adminId: toMongoId(admin._id.toString()),
        otp,
        type: verificationType.RESET_PASSWORD,
        createdAt: UTCTime(),
      });

      // send email
      await this.mailService.sendOtp(admin.email, otp);

      return {
        message: Message("ADMIN.OTP_SENT", lang),
        expiresIn: userOtpExpiredTime,
      };
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ─── Verify OTP ─────────────────────────────────────────────

  async verifyOtp(input: AdminVerifyOtpInput, lang: string) {
    try {
      const admin = await this.adminUserRepository.findOne({
        email: input.email,
        deleted: false,
      });

      if (!admin) {
        ErrorException(new Error(), "ADMIN.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      const verification = await this.hasValidOtp(admin._id);

      if (!verification) {
        ErrorException(
          new Error(),
          "ADMIN.OTP_EXPIRED",
          HttpStatus.BAD_REQUEST,
        );
      }

      if (verification.otp !== input.otp) {
        ErrorException(
          new Error(),
          "ADMIN.INVALID_OTP",
          HttpStatus.BAD_REQUEST,
        );
      }

      // OTP is valid — mark it verified by updating type/flag
      // We keep the record alive so updatePassword can re-verify it
      // TTL will clean it up automatically after expiry

      return {
        message: Message("ADMIN.OTP_VERIFIED", lang),
        otpVerified: true,
      };
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ─── Update Password ─────────────────────────────────────────

  async updatePassword(input: AdminUpdatePasswordInput, lang: string) {
    try {
      const admin = await this.adminUserRepository.findOne({
        email: input.email,
        deleted: false,
      });

      if (!admin) {
        ErrorException(new Error(), "ADMIN.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      // re-verify OTP here so this endpoint can't be called without a valid OTP
      const verification = await this.hasValidOtp(admin._id);

      if (!verification) {
        ErrorException(new Error(), "ADMIN.OTP_EXPIRED", HttpStatus.BAD_REQUEST);
      }

      if (verification.otp !== input.otp) {
        ErrorException(new Error(), "ADMIN.INVALID_OTP", HttpStatus.BAD_REQUEST);
      }

      const hashed = await hashPassword(input.newPassword, passwordSalt);

      await this.adminUserRepository.findByIdAndUpdate(admin._id, {
        password: hashed,
      });

      // delete OTP record — job is done
      await this.adminVerificationRepository.findOneAndDelete({
        adminId: admin._id,
        type: verificationType.RESET_PASSWORD,
      });

      return {
        message: Message("ADMIN.PASSWORD_UPDATED", lang),
      };
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}