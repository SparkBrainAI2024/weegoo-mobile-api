// apps/admin/src/auth/admin-auth.service.ts
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

import {
  BasicResponse,
  UserTokenMetaRepository,
  UserVerificationRepository,
} from "@libs/data-access";
import { EnvService } from "@libs/common/config/env.service";
import {
  ErrorException,
  GenerateRandomDigit,
  generateToken,
  getOtpSentResponse,
  getOtpThrottledResponse,
  isOtpExpired,
  verifyToken,
} from "@libs/common";
import { comparePassword, hashPassword } from "@libs/common/utils/bcrypt";
import { SendGridMailService } from "@libs/services/mail";

import { roles, verificationType } from "@libs/data-access/enums/user.enum";
import {
  passwordSalt,
  tokenTypes,
  userOtpExpiredTime,
  userOtpSalt,
} from "@libs/common/constants";
import { TokenGrantType } from "@libs/data-access/enums/token.enum";
import { Types } from "mongoose";
import {
  AdminSignUpResponse,
  AdminSignInResponse,
} from "@libs/data-access/dtos/response/admin-auth.response";
import { AdminUserRepository } from "@libs/data-access/repositories/admin-user.repository";
import { Message } from "@libs/localization";

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    private readonly userVerificationRepository: UserVerificationRepository,
    private readonly userTokenMetaRepository: UserTokenMetaRepository,
    private readonly envService: EnvService,
    private readonly sendGridMailService: SendGridMailService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // Helper method to check if admin has a valid non-expired OTP
  private async hasValidOtp(
    adminId: Types.ObjectId,
    type: string,
  ): Promise<any> {
    const verification = await this.userVerificationRepository.findOne({
      adminId,
      type,
    });
    if (
      verification &&
      !isOtpExpired(verification.createdAt, userOtpExpiredTime)
    ) {
      return verification;
    }
    return null;
  }

  // ─── Signup ───────────────────────────────────────────────────────────────

  // signup
  async signup(
    fullName: string,
    email: string,
    password: string,
    lang: string,
  ): Promise<AdminSignUpResponse> {
    const existing = await this.adminUserRepository.findOne({ email });
    if (existing) {
      ErrorException(null, "USER.EMAIL_ALREADY_EXISTS", HttpStatus.CONFLICT);
    }

    const hashedPassword = await hashPassword(password, passwordSalt);

    const admin = await this.adminUserRepository.create({
      fullName,
      email,
      password: hashedPassword,
    });

    return {
      message: Message(lang, "USER.SIGNUP_SUCCESS"),
      success: true,
      admin: {
        _id: admin._id.toString(),
        fullName: admin.fullName,
        email: admin.email,
      },
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(email: string, password: string, lang: string) {
    const admin = await this.adminUserRepository.findOne({ email });
    if (!admin) {
      ErrorException(
        null,
        "ADMIN_USER.INVALID_CREDENTIALS",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isMatch = await comparePassword(password, admin.password);
    if (!isMatch) {
      ErrorException(
        null,
        "ADMIN_USER.INVALID_CREDENTIALS",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const accessTokenJti = new Types.ObjectId().toString();
    const refreshTokenJti = new Types.ObjectId().toString();

    const accessToken = await generateToken(
      {
        id: admin._id,
        type: tokenTypes.accessToken,
        role: roles.ADMIN,
        jti: accessTokenJti,
      },
      this.envService.getJwtSecretKey(),
      { expiresIn: "1d" },
    );

    const refreshToken = await generateToken(
      {
        id: admin._id,
        type: tokenTypes.refreshToken,
        role: roles.ADMIN,
        jti: refreshTokenJti,
      },
      this.envService.getJwtSecretKey(),
      { expiresIn: "30d" },
    );

    // store token meta — reusing UserTokenMeta with role: ADMIN
    await this.userTokenMetaRepository.create({
      userId: admin._id,
      adminId: admin._id,
      accessTokenJti,
      refreshTokenJti,
      role: roles.ADMIN,
      grant: TokenGrantType.REFRESH_TOKEN,
      email,
    });

    return {
      accessToken,
      refreshToken,
      admin: {
        _id: admin._id.toString(),
        fullName: admin.fullName,
        email: admin.email,
      },
    };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(email: string, lang: string) {
    const admin = await this.adminUserRepository.findOne({ email });
    if (!admin) {
      ErrorException(null, "ADMIN_USER.ADMIN_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    // If the previously sent OTP is still valid (2 minutes expiry),
    // do not send a new mail — just inform that the OTP was already sent.
    const validOtp = await this.hasValidOtp(
      admin._id,
      verificationType.RESET_PASSWORD,
    );
    if (validOtp) {
      return getOtpThrottledResponse(lang, validOtp.createdAt);
    }

    const otp = GenerateRandomDigit(userOtpSalt);

    await this.userVerificationRepository.sendOtp(
      admin._id,
      otp,
      verificationType.RESET_PASSWORD,
      true, //isAdmin
    );

    // Send the OTP using the dynamic "forgot-password" email template,
    // passing the otp code (and name) as template variables.
    await this.sendGridMailService.sendEmail({
      to: admin.email,
      subject: "Reset Your Password",
      templateSlug: "reset-password",
      variables: {
        name: admin.fullName || "Admin",
        otp,
        expiry_minutes: 2,
      },
    });

    return getOtpSentResponse(lang);
  }

  async verifyOtp(email: string, otp: number, lang: string): Promise<any> {
    const admin = await this.adminUserRepository.findOne({ email });
    if (!admin) {
      ErrorException(null, "ADMIN_USER.ADMIN_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    const verification = await this.userVerificationRepository.findOne({
      adminId: admin._id,
      otp,
      type: verificationType.RESET_PASSWORD,
    });
    if (!verification) {
      ErrorException(null, "USER.INVALID_OTP", HttpStatus.BAD_REQUEST);
    }
    const resetPasswordToken = await generateToken(
      {
        id: admin._id,
        email: admin.email,
        type: tokenTypes.resetPasswordToken,
      },
      this.envService.getJwtSecretKey(),
      {
        expiresIn: this.envService.getResetPasswordTokenLife(),
      },
    );

    await this.userVerificationRepository.deleteOtpById(verification._id);

    return {
      message: Message(lang, "USER.OTP_VERIFICATION_SUCCESS"),
      success: true,
      resetPasswordToken, // ← client uses this for resetPassword
    };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────
  async resetPassword(
    resetPasswordToken: string,
    newPassword: string,
    lang: string,
  ) {
    const decoded: any = await verifyToken(
      resetPasswordToken,
      this.envService.getJwtSecretKey(),
    );

    if (!decoded || decoded.type !== tokenTypes.resetPasswordToken) {
      ErrorException(
        null,
        "USER.INVALID_RESET_PASSWORD_TOKEN",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const hashedPassword = await hashPassword(newPassword, passwordSalt);
    await this.adminUserRepository.updateOne(
      { _id: decoded.id },
      { $set: { password: hashedPassword } },
    );

    return {
      message: Message(lang, "USER.PASSWORD_RESET_SUCCESS"),
      success: true,
    };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────
  async refreshToken(
    refreshTokenInput: string,
    lang: string,
  ): Promise<AdminSignInResponse> {
    const decoded: any = await verifyToken(
      refreshTokenInput,
      this.envService.getJwtSecretKey(),
    );

    if (
      !decoded ||
      decoded.type !== tokenTypes.refreshToken ||
      decoded.role !== roles.ADMIN
    ) {
      ErrorException(null, "COMMON.INVALID_TOKEN", HttpStatus.UNAUTHORIZED);
    }

    // Verify session meta exists in DB for security (Refresh Token Rotation)
    const tokenMeta = await this.userTokenMetaRepository.findByRefreshTokenJti(
      decoded.jti,
    );
    if (!tokenMeta) {
      ErrorException(null, "COMMON.INVALID_TOKEN", HttpStatus.UNAUTHORIZED);
    }

    const admin = await this.adminUserRepository.findOne({
      _id: decoded.id,
    });
    if (!admin) {
      ErrorException(
        null,
        "ADMIN_USER.ADMIN_NOT_FOUND",
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Invalidate old refresh token session
    await this.userTokenMetaRepository.deleteByRefreshTokenJti(decoded.jti);

    const accessTokenJti = new Types.ObjectId().toString();
    const refreshTokenJti = new Types.ObjectId().toString();

    const accessToken = await generateToken(
      {
        id: admin._id,
        type: tokenTypes.accessToken,
        role: roles.ADMIN,
        jti: accessTokenJti,
      },
      this.envService.getJwtSecretKey(),
      { expiresIn: "1d" },
    );

    const refreshToken = await generateToken(
      {
        id: admin._id,
        type: tokenTypes.refreshToken,
        role: roles.ADMIN,
        jti: refreshTokenJti,
      },
      this.envService.getJwtSecretKey(),
      { expiresIn: "30d" },
    );

    await this.userTokenMetaRepository.create({
      userId: admin._id,
      adminId: admin._id,
      accessTokenJti,
      refreshTokenJti,
      role: roles.ADMIN,
      grant: TokenGrantType.REFRESH_TOKEN,
      email: admin.email,
    });

    return {
      accessToken,
      refreshToken,
      admin: {
        _id: admin._id.toString(),
        fullName: admin.fullName,
        email: admin.email,
      },
    };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  async logout(accessTokenJti: string, lang: string): Promise<BasicResponse> {
    if (accessTokenJti) {
      await this.userTokenMetaRepository.deleteByAccessTokenJti(accessTokenJti);
    }
    return {
      message: Message(lang, "USER.LOGGED_OUT"),
      success: true,
    };
  }
}
