  // apps/admin/src/auth/admin-auth.service.ts
  import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

  import { UserTokenMetaRepository, UserVerificationRepository } from '@libs/data-access';
  import { EnvService } from '@libs/common/config/env.service';
  import { GenerateRandomDigit, generateToken, verifyToken } from '@libs/common';
  import { comparePassword, hashPassword } from "@libs/common/utils/bcrypt";

  import { roles, verificationType } from '@libs/data-access/enums/user.enum';
  import { passwordSalt, tokenTypes, userOtpSalt } from '@libs/common/constants';
  import { TokenGrantType } from '@libs/data-access/enums/token.enum';
  import { Types } from 'mongoose';
import { AdminSignUpResponse } from '@libs/data-access/dtos/response/admin-auth.response';
import { AdminUserRepository } from '@libs/data-access/repositories/admin-user.repository';

  @Injectable()
  export class AdminAuthService {
    constructor(
      private readonly adminUserRepository: AdminUserRepository,
      private readonly userVerificationRepository: UserVerificationRepository,
      private readonly userTokenMetaRepository: UserTokenMetaRepository,
      private readonly envService: EnvService,
    ) { }

    // ─── Signup ───────────────────────────────────────────────────────────────

// signup
async signup(fullName: string, email: string, password: string): Promise<AdminSignUpResponse> {
  const existing = await this.adminUserRepository.findOne({ email });
  if (existing) {
    throw new HttpException('USER .EMAIL_ALREADY_EXISTS', HttpStatus.CONFLICT);
  }

  const hashedPassword = await hashPassword(password, passwordSalt);

  const admin = await this.adminUserRepository.create({
    fullName,
    email,
    password: hashedPassword,
  });

  return {
    message: 'USER.SIGNUP_SUCCESS',
    success: true,
    admin: {
      _id: admin._id.toString(),
      fullName: admin.fullName,
      email: admin.email,
    },
  };
}

    // ─── Login ────────────────────────────────────────────────────────────────

    async login(email: string, password: string) {
      const admin = await this.adminUserRepository.findOne({ email });
      if (!admin) {
        throw new HttpException('AUTH.INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED);
      }

      const isMatch = await comparePassword(password, admin.password);
      if (!isMatch) {
        throw new HttpException('AUTH.INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED);
      }

      const accessTokenJti = new Types.ObjectId().toString();
      const refreshTokenJti = new Types.ObjectId().toString();

      const accessToken = await generateToken(
        { id: admin._id, type: tokenTypes.accessToken, role: roles.ADMIN, jti: accessTokenJti },
        this.envService.getJwtSecretKey(),
        { expiresIn: '1d' },
      );

      const refreshToken = await generateToken(
        { id: admin._id, type: tokenTypes.refreshToken, role: roles.ADMIN, jti: refreshTokenJti },
        this.envService.getJwtSecretKey(),
        { expiresIn: '30d' },
      );

      // store token meta — reusing UserTokenMeta with role: ADMIN
      await this.userTokenMetaRepository.create({
        userId: admin._id,
        accessTokenJti,
        refreshTokenJti,
        role: roles.ADMIN,
        grant: TokenGrantType.REFRESH_TOKEN,
        email,
      });

      return { accessToken, refreshToken, admin: { _id: admin._id.toString(), fullName: admin.fullName, email: admin.email } };
    }

    // ─── Forgot Password ──────────────────────────────────────────────────────

    async forgotPassword(email: string) {
      const admin = await this.adminUserRepository.findOne({ email });
      if (!admin) {
        throw new HttpException('AUTH.ADMIN_NOT_FOUND', HttpStatus.NOT_FOUND);
      }
      const otp = GenerateRandomDigit(userOtpSalt);


      await this.userVerificationRepository.sendOtp(
        admin._id,
        otp,
        verificationType.RESET_PASSWORD,
        true //isAdmin
      );

      // TODO: send otp via email (mail service)

      return { message: 'USER.OTP_SEND', success:true };
    }

async verifyOtp(email: string, otp: number): Promise<any> {
  const admin = await this.adminUserRepository.findOne({ email });
  if (!admin) {
    throw new HttpException('AUTH.ADMIN_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  const verification = await this.userVerificationRepository.findOne({
    adminId: admin._id,
    otp,
    type: verificationType.RESET_PASSWORD,
  });
  if (!verification) {
    throw new HttpException('AUTH.INVALID_OTP', HttpStatus.BAD_REQUEST);
  }
  const resetPasswordToken = await generateToken(
    {
      id: admin._id,
      email: admin.email,
      type: tokenTypes.resetPasswordToken,
    },
    this.envService.getJwtSecretKey(),
    { expiresIn:"15m"  
      // "this.envService.getResetPasswordTokenLife()" 
    },
  );

  await this.userVerificationRepository.deleteOtpById(verification._id);

  return {
    message: 'USER.OTP_VERIFICATION_SUCCESS',
    success: true,
    resetPasswordToken,  // ← client uses this for resetPassword
  };
}

    // ─── Reset Password ───────────────────────────────────────────────────────
async resetPassword(resetPasswordToken: string, newPassword: string) {
  const decoded: any = await verifyToken(
    resetPasswordToken,
    this.envService.getJwtSecretKey(),
  );

  if (!decoded || decoded.type !== tokenTypes.resetPasswordToken) {
    throw new HttpException('AUTH.INVALID_TOKEN', HttpStatus.UNAUTHORIZED);
  }

  const hashedPassword = await hashPassword(newPassword, passwordSalt);
  await this.adminUserRepository.updateOne(
    { _id: decoded.id },
    { $set: { password: hashedPassword } },
  );

  return { message: 'AUTH.PASSWORD_RESET_SUCCESS', success: true };
}
  }