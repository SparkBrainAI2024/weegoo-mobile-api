import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { ErrorException } from "@libs/common/exceptions";
import { comparePassword, hashPassword } from "@libs/common/utils/bcrypt";
import { isOtpExpired, UTCTime } from "@libs/common/utils/datetime";
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
  EmailSignInInput,
  EmailSignUpInput,
  VerifyEmailInput,
  DeviceRepository,
  UserRepository,
  UserVerificationRepository,
  UserTokenMetaRepository,
  UserDocument,
  UserDetailsRepository,
  UserDetailsDocument,
  verificationType,
  EmailInput,
  PhoneInput,
  GoogleSignInInput,
  GoogleSignUpInput,
  AuthProvider,
  PhoneSignUpInput,
  PhoneSignInInput,
  VerifyPhoneInput,
} from "@libs/data-access";
import { Message } from "@libs/localization";
import { EnvService } from "@libs/common/config/env.service";
import { SocialAuthService } from "@libs/services/social-auth";

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
};

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userVerificationRepository: UserVerificationRepository,
    private readonly userTokenMetaRepository: UserTokenMetaRepository,
    private readonly mailService: MailService,
    private readonly deviceRepository: DeviceRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly envService: EnvService,
    private readonly socialAuthService: SocialAuthService,
  ) { }

  // Helper method to check if user has valid non-expired OTP
  private async hasValidOtp(userId: Types.ObjectId, type: string): Promise<any> {
    const verification = await this.userVerificationRepository.findOne({
      userId,
      type,
    });
    if (verification && !isOtpExpired(verification.createdAt,userOtpExpiredTime)) {
      return verification;
    }
    return null;
  }

  private async createAuthTokens(
    userId: Types.ObjectId | string,
    email: string,
    deviceId: string = null,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessTokenJti = generateMongoDbId();
    const refreshTokenJti = generateMongoDbId();

    const accessTokenData = {
      id: userId,
      email,
      jti: accessTokenJti,
      grant: 'access',
      type: tokenTypes.accessToken,
      deviceId,
    };
    const refreshTokenData = {
      id: userId,
      email,
      jti: refreshTokenJti,
      grant: 'refresh_token',
      type: tokenTypes.refreshToken,
      deviceId,
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
      email || '',
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
      profileImage: userDetails.profileImage,
      dateOfBirth: userDetails.dateOfBirth,
      bio: userDetails.bio,
      gender: userDetails.gender,
      createdAt: userDetails.createdAt,
      geoLocation: userDetails?.geoLocation?.type ? userDetails.geoLocation : null,
      userId: userDetails.userId,
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
    type: string = verificationType.VERIFICATION_EMAIL,
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
      ErrorException(null, "USER.INVALID_EMAIL", HttpStatus.UNAUTHORIZED);
    }
     if (!user.verified) {
      ErrorException(null, "USER.EMAIL_NOT_VERIFIED", HttpStatus.UNAUTHORIZED);
    }
    const userDetails = await this.userDetailsRepository.findOne({ userId: user._id });
    if (!userDetails) {
      ErrorException(null, "USER.INVALID_EMAIL", HttpStatus.UNAUTHORIZED);
    }
    if (password !== undefined) {
      const checkPassword = await comparePassword(password, user.password);
      if (!checkPassword) {
        ErrorException(null, "USER.INCORRECT_PASSWORD", HttpStatus.UNAUTHORIZED);
      }
    }
    if (user.suspended) {
      ErrorException(null, "USER.SUSPENDED", HttpStatus.UNAUTHORIZED);
    }
    return { user, userDetails };
  }

  private async validateUserForSignInPhone(phone: string, password?: string): Promise<{ user: UserDocument; userDetails: UserDetailsDocument }> {
    const user = await this.userRepository.findByPhone(phone);
    if (!user) {
      ErrorException(null, "USER.INVALID_PHONE", HttpStatus.UNAUTHORIZED);
    }
    const userDetails = await this.userDetailsRepository.findOne({ userId: user._id });
    if (!userDetails) {
      ErrorException(null, "USER.INVALID_PHONE", HttpStatus.UNAUTHORIZED);
    }
    if (password && user?.password) {
      const checkPassword = await comparePassword(password, user?.password || '');
      if (!checkPassword) {
        ErrorException(null, "USER.INCORRECT_PASSWORD", HttpStatus.UNAUTHORIZED);
      }
    } else {
      ErrorException(null, "USER.PASSWORD_NOT_SET", HttpStatus.BAD_REQUEST);
    }
    if (user.suspended) {
      ErrorException(null, "USER.SUSPENDED", HttpStatus.UNAUTHORIZED);
    }
    return { user, userDetails };
  }

  async signup(createUserInput: EmailSignUpInput, lang: string) {

    try {
      const { email, fullName, gender, phone } = createUserInput;
      const userExistWithThisEmail = await this.userRepository.findByEmail(email);
      if (userExistWithThisEmail?.password) {
        ErrorException(null, "USER.USED_EMAIL", HttpStatus.BAD_REQUEST);
      }

      if (userExistWithThisEmail) {
        // Check if there's a valid non-expired OTP
        const validOtp = await this.hasValidOtp(userExistWithThisEmail._id, verificationType.VERIFICATION_EMAIL);
        
        if (validOtp) {
          // OTP still valid, just return message without sending new code
          return {
            message: Message(lang, "USER.USER_CREATED"),
            success: true,
          };
        }

        // OTP expired or doesn't exist, send new code
        const verificationCode = GenerateRandomDigit(userOtpSalt);
        await this.mailService.sendUserConfirmation(email, verificationCode);
        await this.userVerificationRepository.sendEmailVerificationOtp(
          userExistWithThisEmail._id,
          verificationCode,
        );
        return {
          message: Message(lang, "USER.USER_CREATED"),
          success: true,
        };
      }

      // New user signup
      const verificationCode = GenerateRandomDigit(userOtpSalt);
      const sendMail = await this.mailService.sendUserConfirmation(
        email,
        verificationCode,
      );
      if (sendMail) {
        const user: UserDocument = await this.userRepository.create({
          email,
          phone,
        });
        await this.userDetailsRepository.create({
          userId: user._id,
          gender,
          fullName,
        });
        await this.userVerificationRepository.sendEmailVerificationOtp(
          user._id,
          verificationCode,
        );
        return {
          message: Message(lang, "USER.USER_CREATED"),
          success: true,
        };
      } else {
        ErrorException(
          null,
          "USER.CAN_NOT_SEND_MAIL",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async signIn(signInInput: EmailSignInInput) {
    try {
      const { email, password, device } = signInInput;
      const { user, userDetails } = await this.validateUserForSignIn(email, password);
      await this.userRepository.updateOne(
        { _id: user._id },
        { lastLogin: UTCTime() },
      );
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.email);
      await this.registerDeviceIfProvided(user._id, device);
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Phone Signup - sends OTP to phone for verification
  // TODO: Implement phone sending code in later phase
  async phoneSignUp(phoneSignUpInput: PhoneSignUpInput, lang: string) {
    try {
      const { phone } = phoneSignUpInput;
      const userExistWithThisPhone = await this.userRepository.findByPhone(phone);
      if (userExistWithThisPhone?.password) {
        ErrorException(null, "USER.USED_PHONE", HttpStatus.BAD_REQUEST);
      }

      const userTokenData = {
        phone: phone,
        type: tokenTypes.accessToken,
      };
      const userToken = await generateToken(userTokenData, this.envService.getJwtSecretKey(), {
        expiresIn: this.envService.getAccessTokenLife(),
      });

      if (userExistWithThisPhone) {
        // Check if there's a valid non-expired OTP
        const validOtp = await this.hasValidOtp(userExistWithThisPhone._id, verificationType.PHONE);
        
        if (validOtp) {
          // OTP still valid, just return message without sending new code
          return {
            message: Message(lang, "USER.USER_CREATED_PHONE"),
            success: true,
          };
        }

        // OTP expired or doesn't exist, send new code
        // TODO: Implement phone SMS sending in later phase
        // await this.smsService.sendVerificationSms(phone, verificationCode);
        const verificationCode = GenerateRandomDigit(userOtpSalt);
        await this.userVerificationRepository.sendPhoneVerificationOtp(
          userExistWithThisPhone._id,
          verificationCode,
        );
        return {
          message: Message(lang, "USER.USER_CREATED_PHONE"),
          success: true,
        };
      }

      // New user signup
      // TODO: Implement phone SMS sending in later phase
      // await this.smsService.sendVerificationSms(phone, verificationCode);
      const verificationCode = GenerateRandomDigit(userOtpSalt);
      const user: UserDocument = await this.userRepository.create({
        phone,
      });
      await this.userDetailsRepository.create({
        userId: user._id,
      });
      await this.userVerificationRepository.sendPhoneVerificationOtp(
        user._id,
        verificationCode,
      );
      return {
        message: Message(lang, "USER.USER_CREATED_PHONE"),
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

  // Phone Signin - validates phone and returns sign in result
  // TODO: Implement phone SMS sending for OTP verification in later phase
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
      await this.userRepository.updateOne(
        { _id: user._id },
        { lastLogin: UTCTime() },
      );
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.phone);
      await this.registerDeviceIfProvided(user._id, device);
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
    } catch (e) {
      console.log("🚀 ~ file: auth.service.ts:322 ~ AuthService ~ phoneSignIn ~ e:", e)
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
      const verification = await this.userVerificationRepository.findOne({
        userId: user._id,
        otp,
        type: verificationType.RESET_PASSWORD,
      });
      if (!verification) {
        ErrorException(null, "USER.INVALID_OTP", HttpStatus.BAD_REQUEST);
      }
      await this.userRepository.updateOne(
        { _id: user._id },
        { verified: true },
      );
      await this.userVerificationRepository.deleteOtpById(verification._id);
      
      // Generate and return auth tokens after verification
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.phone);
      const userDetails: UserDetailsDocument = await this.userDetailsRepository.findOne({ userId: user._id });
      if (!userDetails) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendVerifyEmailOtp(sendOtpInput: EmailInput, lang: string) {
    try {
      const { email } = sendOtpInput;
      const user: UserDocument = await this.userRepository.findByEmail(email);
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      // Check if there's a valid non-expired OTP
      const validOtp = await this.hasValidOtp(user._id, verificationType.VERIFICATION_EMAIL);
      
      if (validOtp) {
        // OTP still valid, return message without sending new code
        return { message: Message(lang, "USER.OTP_SEND"), success: true };
      }

      // OTP expired or doesn't exist, send new code
      const verificationCode = GenerateRandomDigit(userOtpSalt);
      const sendMail = await this.mailService.sendUserConfirmation(
        email,
        verificationCode,
      );
      if (sendMail) {
        await this.userVerificationRepository.sendEmailVerificationOtp(
          user._id,
          verificationCode,
        );
        return { message: Message(lang, "USER.OTP_SEND"), success: true };
      } else {
        ErrorException(
          null,
          "USER.CAN_NOT_SEND_MAIL",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verifyEmail(verifyEmaillInput: VerifyEmailInput, lang: string) {
    try {
      const { email, otp } = verifyEmaillInput;
      const { user, verification } = await this.verifyOtpForUser(email, otp);
      if (user.verified) {
        ErrorException(
          null,
          "USER.USER_ALREADY_VERIFIED",
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.userRepository.updateOne(
        { _id: user._id },
        { verified: true },
      );
      await this.userVerificationRepository.deleteOtpById(verification._id);
      
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.email);
      const userDetails: UserDetailsDocument = await this.userDetailsRepository.findOne({ userId: user._id });
      if (!userDetails) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.UNAUTHORIZED);
      }
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
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
      const { phone } = sendOtpInput;
      const user: UserDocument = await this.userRepository.findByPhone(phone);
      if (!user) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      // Check if there's a valid non-expired OTP
      const validOtp = await this.hasValidOtp(user._id, verificationType.VERIFICATION_EMAIL);
      
      if (validOtp) {
        // OTP still valid, return message without sending new code
        return { message: Message(lang, "USER.OTP_SEND"), success: true };
      }

      // OTP expired or doesn't exist, send new code
      const verificationCode = GenerateRandomDigit(userOtpSalt);
      // TODO: Implement phone SMS sending in later phase
      // await this.smsService.sendVerificationSms(phone, verificationCode);
      await this.userVerificationRepository.sendPhoneVerificationOtp(
        user._id,
        verificationCode,
      );
      return { message: Message(lang, "USER.OTP_SEND"), success: true };
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
      const verifiedToken = await verifyToken(
        refreshTokenInput,
        this.envService.getJwtSecretKey(),
      );
      if (!verifiedToken) {
        ErrorException(null, "COMMON.INVALID_TOKEN", HttpStatus.BAD_REQUEST);
      }
      if (verifiedToken.type !== tokenTypes.refreshToken) {
        ErrorException(null, "COMMON.INVALID_TOKEN", HttpStatus.BAD_REQUEST);
      }
      const user: UserDocument = await this.userRepository.findOne({
        _id: verifiedToken.id,
      });
      const userDetails: UserDetailsDocument = await this.userDetailsRepository.findOne({
        userId: user._id,
      });
      if (!user || !userDetails) {
        ErrorException(null, "USER.NOT_FOUND", HttpStatus.UNAUTHORIZED);
      }
      if (user.suspended) {
        ErrorException(null, "USER.SUSPENDED", HttpStatus.UNAUTHORIZED);
      }
      await this.userRepository.updateOne(
        { _id: user._id },
        { lastLogin: UTCTime() },
      );
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.email, verifiedToken.deviceId);
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
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
      const verifiedToken = await verifyToken(
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

  async googleSignUp(googleSignUpInput: GoogleSignUpInput, lang: string) {
    try {
      const { token, deviceId } = googleSignUpInput;
      const socialUser = await this.socialAuthService.verifyToken(token, 'google');
      console.log("🚀 ~ file: auth.service.ts:333 ~ AuthService ~ googleSignUp ~ socialUser:", socialUser)
      if (!socialUser.email) {
        ErrorException(null, "SOCIAL_AUTH.EMAIL_NOT_PROVIDED", HttpStatus.BAD_REQUEST);
      }
      let user: UserDocument = await this.userRepository.findByEmail(socialUser.email);
      if (!user) {
        user = await this.userRepository.create({
          email: socialUser.email,
          phone: null,
          verified: true,
          authProvider: AuthProvider.GOOGLE,
          authProviderId: socialUser.providerId,
        });
        await this.userDetailsRepository.create({
          userId: user._id,
          fullName: socialUser.name || '',
          profileImage: socialUser.picture || '',
        });
      }
      const userDetails: UserDetailsDocument = await this.userDetailsRepository.findOne({ userId: user._id });
      await this.registerDeviceIfProvided(user._id, { deviceId, firebaseToken: null, deviceType: null });
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.email);
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
    } catch (e) {
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
      console.log("🚀 ~ file: auth.service.ts:333 ~ AuthService ~ googleSignIn ~ socialUser:", socialUser)
      if (!socialUser.email) {
        ErrorException(null, "SOCIAL_AUTH.EMAIL_NOT_PROVIDED", HttpStatus.BAD_REQUEST);
      }
      const { user, userDetails } = await this.validateUserForSignIn(socialUser.email);
      await this.userRepository.updateOne(
        { _id: user._id },
        { lastLogin: UTCTime() },
      );
      const { accessToken, refreshToken } = await this.createAuthTokens(user._id, user.email);
      await this.registerDeviceIfProvided(user._id, device);
      const result = this.buildSignInResult(user, userDetails, accessToken, refreshToken);
      return result;
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
