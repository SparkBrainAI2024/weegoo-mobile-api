import { HttpStatus, Injectable, Inject } from "@nestjs/common";
import { Types } from "mongoose";
import { ErrorException } from "@libs/common/exceptions";
import { comparePassword, hashPassword } from "@libs/common/utils/bcrypt";
import { isOtpExpired, UTCTime } from "@libs/common/utils/datetime";
import * as Jwt from 'jsonwebtoken';
import {
  generateMongoDbId,
  GenerateRandomDigit,
} from "@libs/common/utils/id.generator";
import { generateToken, verifyToken } from "@libs/common/utils/jwt";
import { passwordSalt, tokenTypes, userOtpSalt, userOtpExpiredTime } from "@libs/common/constants";
import { MailService } from "@libs/services/mail";
import {
  ResetPasswordInput,
  SetPasswordInput,
  DeviceRepository,
  UserRepository,
  UserVerificationRepository,
  UserTokenMetaRepository,
  UserDocument,
  UserDetailsRepository,
  UserDetailsDocument,
  verificationType,
  PhoneInput,
  GoogleSignInInput,
  GoogleSignUpInput,
  AuthProvider,
  PhoneSignUpInput,
  PhoneSignInInput,
  VerifyPhoneInput,
  UpdatePhoneInput,
  VerifyEmailInput,
  roles,
  BasicResponse,
  TokenGrantType,
} from "@libs/data-access";
import { Message } from "@libs/localization";
import { EnvService } from "@libs/common/config/env.service";
import { SocialAuthService } from "@libs/services/social-auth";
import { toMongoId } from "@libs/common";
import {
  getCurrentTimestamp,
  getRemainingTime,
  getOtpThrottledResponse,
  getOtpSentResponse,
  getUpdatedRoles
} from "@libs/common/utils/auth.utils";
import { getActiveProfileImageUrl } from "@libs/common/utils/entity.utils";
import { S3Service } from "@libs/s3/s3.service";

export interface SignInResult {
  user: UserResponse;
  userDetails: UserDetailsResponse;
  accessToken: string;
  refreshToken: string;
}

export type UserResponse = {
  _id: Types.ObjectId;
  email: string;
  phone: string;
  verified: boolean;
  language: string;
  suspended: boolean;
  profileCompleted: boolean;
  loginAs: string;
};

export type UserDetailsResponse = {
  fullName: string;
  address: string;
  profileImage: string;
  dateOfBirth: Date;
  bio: string;
  gender: string;
  createdAt: Date;
  geoLocation: any;
  userId: Types.ObjectId;
  province?: string;
  district?: string;
  streetName?: string;
  ridePreference?: string;
  _id?: string;
};

const MAX_PHONE_UPDATE_LIMIT = 5;

@Injectable()
export class AuthService {
  constructor(
    @Inject('AUTH_DEFAULT_ROLE') private readonly defaultRole: string,
    private readonly userRepository: UserRepository,
    private readonly userVerificationRepository: UserVerificationRepository,
    private readonly userTokenMetaRepository: UserTokenMetaRepository,
    private readonly mailService: MailService,
    private readonly deviceRepository: DeviceRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly envService: EnvService,
    private readonly socialAuthService: SocialAuthService,
    private readonly s3: S3Service,
  ) { }

  // Helper method to check if user has valid non-expired OTP
  private async hasValidOtp(userId: Types.ObjectId, type: string): Promise<any> {
    const verification = await this.userVerificationRepository.findOne({
      userId,
      type,
    });
    if (verification && !isOtpExpired(verification.createdAt, userOtpExpiredTime)) {
      return verification;
    }
    return null;
  }

  private async clearAllUserSession(userId: string) {
    await this.userTokenMetaRepository.deleteByUser(userId);

  }


  // Helper to extract the token expiry timestamp from a JWT
  private getTokenExpiryFromJwt(token: string): number {
    try {
      const decoded: any = Jwt.decode(token);
      return decoded?.exp || 0;
    } catch {
      return 0;
    }
  }

  private async createAuthTokens(
    userId: Types.ObjectId | string,
    identifier: string,
    roles: string[] = [],
    deviceId: string = null,
    firebaseToken: string = null
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessTokenJti = generateMongoDbId();
    const refreshTokenJti = generateMongoDbId();

    const accessTokenData = {
      id: userId,
      identifier,
      jti: accessTokenJti,
      grant: 'access',
      type: tokenTypes.accessToken,
      deviceId,
      firebaseToken,
      role: this.defaultRole,
    };
    const refreshTokenData = {
      id: userId,
      identifier,
      type: tokenTypes.refreshToken,
      deviceId,
      firebaseToken,
      role: this.defaultRole,
    };

    const [accessToken, refreshToken] = await Promise.all([
      generateToken(accessTokenData, this.envService.getJwtSecretKey(), {
        expiresIn: this.envService.getAccessTokenLife(),
      }),
      generateToken(refreshTokenData, this.envService.getJwtSecretKey(), {
        expiresIn: this.envService.getRefreshTokenLife(),
      }),
    ]);

    await this.userTokenMetaRepository.createSessionMeta(
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId as Types.ObjectId,
      deviceId,
      accessTokenJti.toString(),
      refreshTokenJti.toString(),
      identifier || '',
      this.defaultRole,
      firebaseToken
    );

    return { accessToken, refreshToken };
  }

  private buildUserResponse(user: UserDocument): UserResponse {
    return {
      _id: user._id,
      email: user.email,
      phone: user.phone,
      verified: user.verified,
      language: user.language,
      suspended: user.suspended,
      profileCompleted: user.profileCompleted,
      loginAs: user.loginAs,
    };
  }

  private buildUserDetailsResponse(userDetails: UserDetailsDocument): UserDetailsResponse {
    return {
      fullName: userDetails.fullName,
      address: userDetails.address,
      profileImage: userDetails.profileImages?.length ? getActiveProfileImageUrl(userDetails.profileImages, (key) => this.s3.getPublicUrl(key)) : null,
      dateOfBirth: userDetails.dateOfBirth,
      bio: userDetails.bio,
      gender: userDetails.gender,
      createdAt: userDetails.createdAt,
      geoLocation: userDetails?.geoLocation?.type ? userDetails.geoLocation : null,
      userId: userDetails.userId,
      province: userDetails?.province || null,
      district: userDetails?.district || null,
      streetName: userDetails?.streetName || null,
      ridePreference: userDetails?.ridePreference || null,
      _id: userDetails._id.toString() || null,
    };
  }

  private buildSignInResult(
    user: UserDocument,
    userDetails: UserDetailsDocument,
    accessToken: string,
    refreshToken: string,
  ): SignInResult {
    return {
      user: this.buildUserResponse(user),
      userDetails: this.buildUserDetailsResponse(userDetails),
      accessToken,
      refreshToken,
    };
  }

  private async verifyOtpForUser(
    email: string,
    otp: string,
    type: string = verificationType.VERIFICATION_PHONE,
  ): Promise<{ user: UserDocument; verification: any }> {
    const user: UserDocument = await this.userRepository.findByEmail(email);
    if (!user) {
      ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const verification = await this.userVerificationRepository.findOne({
      userId: user._id,
      otp,
      type,
    });
    if (!verification) {
      ErrorException(null, "USER.INVALID_OTP", HttpStatus.BAD_REQUEST);
    }
    return { user, verification };
  }

  private async registerDeviceIfProvided(userId: Types.ObjectId, device: { deviceId: string; firebaseToken: string; deviceType: string }): Promise<void> {
    if (device) {
      const { deviceId, firebaseToken, deviceType } = device;
      await this.deviceRepository.addDevice(
        userId,
        deviceId,
        firebaseToken,
        deviceType,
      );
    }
  }

  private async validateUserForSignIn(email: string, password?: string): Promise<{ user: UserDocument; userDetails: UserDetailsDocument }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      ErrorException(null, "USER.INVALID_EMAIL", HttpStatus.NOT_FOUND);
    }
    if (!user.verified) {
      ErrorException(null, "USER.EMAIL_NOT_VERIFIED", HttpStatus.NOT_FOUND);
    }
    const userDetails = await this.userDetailsRepository.findOne({ userId: user._id });
    if (!userDetails) {
      ErrorException(null, "USER.INVALID_EMAIL", HttpStatus.NOT_FOUND);
    }
    if (password !== undefined) {
      const checkPassword = await comparePassword(password, user.password);
      if (!checkPassword) {
        ErrorException(null, "USER.INCORRECT_PASSWORD", HttpStatus.NOT_FOUND);
      }
    }
    if (user.suspended) {
      ErrorException(null, "USER.SUSPENDED", HttpStatus.FORBIDDEN);
    }
    console.log("🚀 ~ file: auth.service.ts ~ AuthService ~ validateUserForSignIn ~ user:", userDetails)
    return { user, userDetails };
  }

  private async validateUserForSignInPhone(phone: string, password?: string): Promise<{ user: UserDocument; userDetails: UserDetailsDocument }> {
    const user = await this.userRepository.findByPhone(phone);
    if (!user) {
      ErrorException(null, "USER.PHONE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const userDetails = await this.userDetailsRepository.findOne({ userId: user._id });
    if (!userDetails) {
      ErrorException(null, "USER.INVALID_PHONE", HttpStatus.NOT_FOUND);
    }
    if (password && user?.password) {
      const checkPassword = await comparePassword(password, user?.password || '');
      if (!checkPassword) {
        ErrorException(null, "USER.INCORRECT_PASSWORD", HttpStatus.NOT_FOUND);
      }
    } else {
      ErrorException(null, "USER.PASSWORD_NOT_SET", HttpStatus.NOT_FOUND);
    }
    if (user.suspended) {
      ErrorException(null, "USER.SUSPENDED", HttpStatus.FORBIDDEN);
    }
    return { user, userDetails };
  }




  // async signIn(signInInput: EmailSignInInput) {
  //   try {
  //     const { email, password, device } = signInInput;
  //     const { user, userDetails } = await this.validateUserForSignIn(email, password);
  //     await this.userRepository.updateOne(
  //       { _id: user._id },
  //       { lastLogin: UTCTime() },
  //     );
  //     const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.email, user.roles);
  //     await this.registerDeviceIfProvided(user._id, device);
  //     const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
  //     return result;
  //   } catch (e) {
  //     ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  // }

  // Phone Signup - sends OTP to phone for verification
  // TODO: Implement phone sending code in later phase
  async phoneSignUp(phoneSignUpInput: PhoneSignUpInput, lang: string) {
    try {
      const { phone } = phoneSignUpInput;
      const userExistWithThisPhone = await this.userRepository.findByPhone(phone);

      if (userExistWithThisPhone) {
        // If user is verified
        if (userExistWithThisPhone.verified) {

          // If password is not set
          if (!userExistWithThisPhone.password) {
            const existingTokenMeta = await this.userTokenMetaRepository.findOne({
              userId: userExistWithThisPhone._id,
              accessTokenJti: { $ne: '' },
              refreshTokenJti: '',
              grant: TokenGrantType.SET_PASSWORD,
            });
            if (existingTokenMeta?.email) {
              // Decode the stored token to check if it's still valid
              const decoded: any = Jwt.decode(existingTokenMeta.email);
              if (decoded?.exp && decoded.exp > Math.floor(Date.now() / 1000) && decoded.phone === userExistWithThisPhone.phone) {
                // Token is still valid, re-send it
                return {
                  message: Message(lang, "USER.SET_PASSWORD_TO_LOGIN"),
                  success: true,
                  currentTime: Math.floor(Date.now() / 1000),
                  expiresBy: decoded.exp,
                  verificationToken: existingTokenMeta.email,
                };
              }
              // Token expired, clean up the stale entry
              await this.userTokenMetaRepository.deleteByAccessTokenJti(existingTokenMeta.accessTokenJti);
            }
            // Generate new verification token
            const validOtp = await this.hasValidOtp(userExistWithThisPhone._id, verificationType.VERIFICATION_PHONE);
            if (validOtp) {
              return getOtpThrottledResponse(lang, validOtp.createdAt);
            }
            // Send new OTP
            const verificationCode = GenerateRandomDigit(userOtpSalt);
            await this.userVerificationRepository.sendPhoneVerificationOtp(
              userExistWithThisPhone._id,
              verificationCode,
            );
            return getOtpSentResponse(lang, "USER.USER_CREATED_PHONE");
          }

          else {
            if (!userExistWithThisPhone.roles.includes(this.defaultRole)) {
              ErrorException(null, "USER.USER_ALREADY_REGISTERED_AS_CUSTOMER", HttpStatus.BAD_REQUEST);
            } // If password is already set, prompt user to sign in
            else ErrorException('', "USER.USED_PHONE", HttpStatus.BAD_REQUEST);

          };
        }

        // User exists but not verified - OTP flow
        // Check if there's a valid non-expired OTP
        const validOtp = await this.hasValidOtp(userExistWithThisPhone._id, verificationType.VERIFICATION_PHONE);

        if (validOtp) {
          // OTP still valid, just return message without sending new code
          return getOtpThrottledResponse(lang, validOtp.createdAt);
        }

        // OTP expired or doesn't exist, send new code
        const verificationCode = GenerateRandomDigit(userOtpSalt);
        await this.userVerificationRepository.sendPhoneVerificationOtp(
          userExistWithThisPhone._id,
          verificationCode,
        );
        return getOtpSentResponse(lang, "USER.USER_CREATED_PHONE");
      }

      // New user signup
      const verificationCode = GenerateRandomDigit(userOtpSalt);
      console.log("🚀 ~ file: auth.service.ts ~ AuthService ~ phoneSignUp ~ verificationCode:", [...new Set([...userExistWithThisPhone?.roles || [], this.defaultRole])], this.defaultRole)
      const user: UserDocument = await this.userRepository.create({
        phone,
        roles: getUpdatedRoles(userExistWithThisPhone?.roles, this.defaultRole)
      });
      await this.userDetailsRepository.create({
        userId: user._id,
      });
      await this.userVerificationRepository.sendPhoneVerificationOtp(
        user._id,
        verificationCode,
      );
      return getOtpSentResponse(lang, "USER.USER_CREATED_PHONE");
    } catch (e) {
      console.log("🚀 ~ file: auth.service.ts ~ AuthService ~ phoneSignUp ~ e:", e)
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updatePhone(input: UpdatePhoneInput, lang: string) {
    try {
      const { email, phone } = input;
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      // Requirement: Only accessible to social auth providers (Google or Apple)
      if (user.authProvider !== AuthProvider.GOOGLE && user.authProvider !== AuthProvider.APPLE) {
        ErrorException(
          null,
          "COMMON.UNAUTHORIZED",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Requirement: If verified, show specific message
      if (user.verified) {
        ErrorException(
          null,
          "USER.ALREADY_VERIFIED_CHECK_PROFILE",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Requirement: Track update threshold
      const currentUpdateCount = (user as any).phoneUpdateCount || 0;
      if (currentUpdateCount >= MAX_PHONE_UPDATE_LIMIT) {
        await this.userRepository.updateOne(
          { _id: user._id },
          { suspended: true },
        );
        ErrorException(
          null,
          "USER.SUSPENDED_TOO_MANY_UPDATES",
          HttpStatus.FORBIDDEN,
        );
      }

      // Requirement: Check if previous OTP is not expired
      const validOtp = await this.hasValidOtp(user._id, verificationType.VERIFICATION_PHONE);
      if (validOtp) {
        return getOtpThrottledResponse(lang, validOtp.createdAt) as any;
      }

      // Requirement: If not verified and previous code expired, update phone and send new code
      await this.userRepository.updateOne(
        { _id: user._id },
        { phone, phoneUpdateCount: currentUpdateCount + 1 },
      );
      const verificationCode = GenerateRandomDigit(userOtpSalt);

      // TODO: Implement phone SMS sending in later phase
      await this.userVerificationRepository.sendPhoneVerificationOtp(user._id, verificationCode);

      return getOtpSentResponse(lang, 'USER.OTP_SEND')
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Phone Signin - validates phone and returns sign in result
  async phoneSignIn(phoneSignInInput: PhoneSignInInput, lang: string) {
    try {
      const { phone, device, password } = phoneSignInInput;
      const { user, userDetails } = await this.validateUserForSignInPhone(phone, password);
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }
      if (user.suspended) {
        ErrorException(null, "USER.SUSPENDED", HttpStatus.UNAUTHORIZED);
      }
      if (!userDetails) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      // Add role if not present and set loginAs
      const updatedRoles = getUpdatedRoles(user.roles, this.defaultRole);

      // Clear previous token meta
      await this.clearAllUserSession(user._id.toString());

      await this.userRepository.updateOne(
        { _id: user._id },
        {
          lastLogin: UTCTime(),
          loginAs: this.defaultRole,
          roles: updatedRoles,
        },
      );

      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.phone, updatedRoles, device?.deviceId, device?.firebaseToken);
      await this.registerDeviceIfProvided(user._id, device);
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
    } catch (e) {
      console.log("🚀 ~ file: auth.service.ts ~ AuthService ~ phoneSignIn ~ e:", e)
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Verify Phone OTP
  async verifyPhone(verifyPhoneInput: VerifyPhoneInput, lang: string) {
    try {
      const { phone, otp } = verifyPhoneInput;
      const user: UserDocument = await this.userRepository.findByPhone(phone);
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      if (user.authProvider === AuthProvider.GOOGLE || user.authProvider === AuthProvider.APPLE) {
        ErrorException(null, "COMMON.VERIFY_PHONE_UNKNOWN_PROVIDER", HttpStatus.FORBIDDEN);
      }

      // If user is already verified AND has password, return message
      if (user.verified && user.password) {
        return { message: Message(lang, "USER.USER_ALREADY_VERIFIED"), success: true };
      }

      const verification = await this.userVerificationRepository.findOne({
        userId: user._id,
        otp,
        type: verificationType.VERIFICATION_PHONE,
      });
      if (!verification) {
        ErrorException(null, "USER.INVALID_OTP", HttpStatus.BAD_REQUEST);
      }

      // Set verified to true (for new users or re-verification)
      await this.userRepository.updateOne(
        { _id: user._id },
        { verified: true },
      );
      await this.userVerificationRepository.deleteOtpById(verification._id);

      // If password is not set, generate verification token for first-time password setup
      if (!user.password) {
        const verificationTokenJti = generateMongoDbId();
        const verificationToken = await generateToken(
          {
            id: user._id,
            phone: user.phone,
            jti: verificationTokenJti,
            type: tokenTypes.setPasswordToken,
          },
          this.envService.getJwtSecretKey(),
          { expiresIn: this.envService.getResetPasswordTokenLife() },
        );

        // Store the verification token JTI in user-token-meta for server-side validation
        await this.userTokenMetaRepository.create({
          userId: user._id,
          accessTokenJti: verificationTokenJti.toString(),
          refreshTokenJti: '',
          deviceId: null,
          email: verificationToken as string,
          role: this.defaultRole,
          grant: TokenGrantType.SET_PASSWORD,
        });

        const currentTime = Math.floor(Date.now() / 1000);
        const expiresBy = this.getTokenExpiryFromJwt(verificationToken as string);

        return {
          message: Message(lang, "USER.SET_PASSWORD_TO_LOGIN"),
          success: true,
          currentTime,
          expiresBy,
          verificationToken,
        };
      }

      return {
        message: Message(lang, "USER.USER_VERIFICATION_SUCCESS"),
        success: true,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Verify Google Phone OTP - only for Google auth provider users
  async verifyGooglePhone(verifyPhoneInput: VerifyPhoneInput, lang: string) {
    try {
      const { phone, otp } = verifyPhoneInput;
      const user: UserDocument = await this.userRepository.findByPhone(phone);
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      // Only allow Google auth provider users
      if (user.authProvider !== AuthProvider.GOOGLE) {
        ErrorException(null, "COMMON.VERIFY_PHONE_UNKNOWN_PROVIDER", HttpStatus.FORBIDDEN);
      }

      if (user.verified) {
        ErrorException(null, "USER.USER_ALREADY_VERIFIED", HttpStatus.BAD_REQUEST);
      }

      const verification = await this.userVerificationRepository.findOne({
        userId: user._id,
        otp,
        type: verificationType.VERIFICATION_PHONE,
      });
      if (!verification) {
        ErrorException(null, "USER.INVALID_OTP", HttpStatus.BAD_REQUEST);
      }

      await this.userRepository.updateOne(
        { _id: user._id },
        { verified: true },
      );
      await this.userVerificationRepository.deleteOtpById(verification._id);

      // Generate auth tokens
      const identifier = user.email || user.phone;
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, identifier);

      const userDetails: UserDetailsDocument = await this.userDetailsRepository.findOne({ userId: user._id });
      if (!userDetails) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);

      return {
        ...result,
        message: Message(lang, "USER.PHONE_VERIFIED_SUCCESS"),
        success: true,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendVerifyPhoneOtp(sendOtpInput: PhoneInput, lang: string) {
    try {
      const { phone, type = verificationType.VERIFICATION_PHONE } = sendOtpInput;
      const user: UserDocument = await this.userRepository.findByPhone(phone);
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      // Check if there's a valid non-expired OTP
      const validOtp = await this.hasValidOtp(user._id, type);

      if (validOtp) {
        return getOtpThrottledResponse(lang, validOtp.createdAt);
      }

      // OTP expired or doesn't exist, send new code
      const verificationCode = GenerateRandomDigit(userOtpSalt);
      // TODO: Implement phone SMS sending in later phase
      // await this.smsService.sendVerificationSms(phone, verificationCode);
      await this.userVerificationRepository.sendOtp(
        user._id,
        verificationCode,
        type,
      );
      return getOtpSentResponse(lang);
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verifyResetPasswordOTP(verifyOTPInput: VerifyEmailInput, lang: string) {
    try {
      const { email, otp } = verifyOTPInput;
      const { user, verification } = await this.verifyOtpForUser(email, otp, verificationType.RESET_PASSWORD);
      const resetPasswordToken = await generateToken(
        {
          id: user._id,
          email: user.email,
          type: tokenTypes.resetPasswordToken,
        },
        this.envService.getJwtSecretKey(),
        { expiresIn: this.envService.getResetPasswordTokenLife() },
      );
      await this.userVerificationRepository.deleteOtpById(verification._id);
      return {
        message: Message(lang, "USER.USER_VERIFICATION_SUCCESS"),
        success: true,
        resetPasswordToken,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verifyResetPasswordPhoneOTP(verifyPhoneInput: VerifyPhoneInput, lang: string) {
    try {
      const { phone, otp } = verifyPhoneInput;
      const user: UserDocument = await this.userRepository.findByPhone(phone);
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }
      const verification = await this.userVerificationRepository.findOne({
        userId: user._id,
        otp,
        type: verificationType.RESET_PASSWORD,
      });
      if (!verification) {
        ErrorException(null, "USER.INVALID_OTP", HttpStatus.BAD_REQUEST);
      }
      const resetPasswordToken = await generateToken(
        {
          id: user._id,
          phone: user.phone,
          type: tokenTypes.resetPasswordToken,
        },
        this.envService.getJwtSecretKey(),
        { expiresIn: this.envService.getResetPasswordTokenLife() },
      );
      await this.userVerificationRepository.deleteOtpById(verification._id);
      return {
        message: Message(lang, "USER.USER_VERIFICATION_SUCCESS"),
        success: true,
        resetPasswordToken,
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async loginWithRefreshToken(refreshTokenInput: string) {
    try {
      const verifiedToken: any = await verifyToken(
        refreshTokenInput,
        this.envService.getJwtSecretKey(),
      );
      if (!verifiedToken) {
        ErrorException(null, "COMMON.INVALID_TOKEN", HttpStatus.BAD_REQUEST);
      }
      if (verifiedToken.type !== tokenTypes.refreshToken) {
        ErrorException(null, "COMMON.INVALID_TOKEN", HttpStatus.BAD_REQUEST);
      }

      // Verify the session/JTI exists in the database for security (Refresh Token Rotation)
      const session = await this.userTokenMetaRepository.findOne({
        userId: toMongoId(verifiedToken.id),
        refreshTokenJti: verifiedToken.jti,
        deviceId: verifiedToken.deviceId,
      });

      if (!session) {
        ErrorException(null, "COMMON.INVALID_TOKEN", HttpStatus.UNAUTHORIZED);
      }

      const user: UserDocument = await this.userRepository.findOne({
        _id: verifiedToken.id,
      });
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.UNAUTHORIZED);
      }

      const userDetails: UserDetailsDocument = await this.userDetailsRepository.findOne({
        userId: user._id,
      });
      if (!userDetails) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.UNAUTHORIZED);
      }
      if (user.suspended) {
        ErrorException(null, "USER.SUSPENDED", HttpStatus.UNAUTHORIZED);
      }

      // Add role if not present and set loginAs
      const updatedRoles = getUpdatedRoles(user.roles, this.defaultRole);

      // Clear previous token meta
      await this.clearAllUserSession(user._id.toString());

      await this.userRepository.updateOne(
        { _id: user._id },
        {
          lastLogin: UTCTime(),
          loginAs: this.defaultRole,
          roles: updatedRoles,
        },
      );

      // Use email or phone as the identifier for token generation
      const identifier = user.email || user.phone;
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, identifier, user.roles, verifiedToken.deviceId, verifiedToken.firebaseToken);

      // Optional: Delete the old session meta here if your repository supports it to keep DB clean
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
    } catch (e) {
      console.log("🚀 ~ file: auth.service.ts ~ AuthService ~ loginWithRefreshToken ~ e:", e)
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async setPassword(setPasswordInput: SetPasswordInput, user: UserDocument, lang: string, verificationTokenData?: any) {
    try {
      const { password, device } = setPasswordInput;

      if (user.suspended) {
        ErrorException(null, "USER.SUSPENDED", HttpStatus.UNAUTHORIZED);
      }

      // Verify the JTI from the token exists in user-token-meta (server-side check)
      if (verificationTokenData?.jti) {
        const storedToken = await this.userTokenMetaRepository.findByAccessTokenJti(verificationTokenData.jti);
        if (!storedToken) {
          ErrorException(null, "USER.VERIFICATION_TOKEN_EXPIRED", HttpStatus.BAD_REQUEST);
        }
        // Delete the stored JTI after successful validation (one-time use)
        await this.userTokenMetaRepository.deleteByAccessTokenJti(verificationTokenData.jti);
      }

      // Add role if not present and set loginAs
      const updatedRoles = getUpdatedRoles(user.roles, this.defaultRole);

      // Clear previous token meta
      await this.clearAllUserSession(user._id.toString());

      await this.userRepository.updateOne(
        { _id: user._id },
        {
          password: await hashPassword(password, passwordSalt),
          loginAs: this.defaultRole,
          lastLoginAt: UTCTime(),
          verified: true,
          roles: updatedRoles,
        },
      );

      // Register device if provided
      await this.registerDeviceIfProvided(user._id, device);

      // Generate auth tokens
      const identifier = user.email || user.phone;
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, identifier, updatedRoles, device?.deviceId, device?.firebaseToken);

      const userDetails: UserDetailsDocument = await this.userDetailsRepository.findOne({ userId: user._id });
      if (!userDetails) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      return this.buildSignInResult(user, userDetails, accessToken, refreshToken);
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async resetPassword(resetPasswordInput: ResetPasswordInput, lang: string) {
    try {
      const { password, resetPasswordToken } = resetPasswordInput;
      const verifiedToken: any = await verifyToken(
        resetPasswordToken,
        this.envService.getJwtSecretKey(),
      );
      if (!verifiedToken) {
        ErrorException(null, "COMMON.INVALID_TOKEN", HttpStatus.BAD_REQUEST);
      }
      if (verifiedToken.type !== tokenTypes.resetPasswordToken) {
        ErrorException(null, "COMMON.INVALID_TOKEN", HttpStatus.BAD_REQUEST);
      }
      const user: UserDocument = await this.userRepository.findOne({
        _id: verifiedToken.id,
      });
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.UNAUTHORIZED);
      }
      if (user.suspended) {
        ErrorException(null, "USER.SUSPENDED", HttpStatus.UNAUTHORIZED);
      }
      await this.userRepository.updateOne(
        { _id: user._id },
        { password: await hashPassword(password, passwordSalt) },
      );
      return { message: Message(lang, "USER.PASSWORD_UPDATED"), success: true };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async googleSignUp(googleSignUpInput: GoogleSignUpInput, lang: string): Promise<BasicResponse> {
    try {
      const { token, deviceId, firebaseToken, deviceType } = googleSignUpInput;
      const socialUser = await this.socialAuthService.verifyToken(token, 'google');
      if (!socialUser.email) {
        ErrorException(null, "SOCIAL_AUTH.EMAIL_NOT_PROVIDED", HttpStatus.BAD_REQUEST);
      }
      const existingUser = await this.userRepository.findByEmail(socialUser.email);
      if (existingUser) {
        if (existingUser.verified && !existingUser.roles.includes(this.defaultRole)) {
          ErrorException(null, "USER.USER_ALREADY_REGISTERED_AS_CUSTOMER", HttpStatus.BAD_REQUEST);
        } else if (!existingUser.verified) {
          const validOtp = await this.hasValidOtp(existingUser._id, verificationType.VERIFICATION_PHONE);
          if (validOtp) {
            return getOtpThrottledResponse(lang, validOtp.createdAt) as any;
          } else {
            return {
              message: Message(lang, "USER.GOOGLE_SIGNUP_SUCCESS"),
              success: true,
            };
          }
        } else {
          ErrorException(null, "USER.USED_EMAIL", HttpStatus.BAD_REQUEST);
        }
      }
      const user = await this.userRepository.create({
        email: socialUser.email,
        verified: false,
        authProvider: AuthProvider.GOOGLE,
        authProviderId: socialUser.providerId,
        roles: getUpdatedRoles(existingUser?.roles, this.defaultRole)

      });
      await this.userDetailsRepository.create({
        userId: user._id,
        fullName: socialUser.name || '',
        profileImages: [{
          socialPicture: socialUser.picture || '',
        }]
      });
      await this.registerDeviceIfProvided(user._id, { deviceId, firebaseToken, deviceType });
      return {
        message: Message(lang, "USER.GOOGLE_SIGNUP_SUCCESS"),
        success: true,
      };
    } catch (e) {
      console.log("🚀 ~ file: auth.service.ts ~ AuthService ~ googleSignUp ~ e:", e)
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async googleSignIn(googleSignInInput: GoogleSignInInput) {
    try {
      const { token, device } = googleSignInInput;

      const socialUser = await this.socialAuthService.verifyToken(token, 'google');
      if (!socialUser.email) {
        ErrorException(null, "SOCIAL_AUTH.EMAIL_NOT_PROVIDED", HttpStatus.BAD_REQUEST);
      }
      const { user, userDetails } = await this.validateUserForSignIn(socialUser.email);

      // Add role if not present and set loginAs
      const updatedRoles = getUpdatedRoles(user.roles, this.defaultRole);

      // Clear previous token meta
      await this.clearAllUserSession(user._id.toString());

      await this.userRepository.updateOne(
        { _id: user._id },
        {
          lastLogin: UTCTime(),
          loginAs: this.defaultRole,
          roles: updatedRoles,
        },
      );
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.email, user.roles, device?.deviceId, device?.firebaseToken);
      await this.registerDeviceIfProvided(user._id, device);
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}