import { Module, DynamicModule, Provider } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthService } from './auth.service';
import { AuthController } from './controller/auth.controller';
import { SetPasswordGuard } from '@libs/guards/set-password.guard';
import { MailService, SendGridMailModule } from '@libs/services/mail';
import { EnvService } from '@libs/common/config/env.service';
import { SocialAuthModule } from '@libs/services/social-auth';
import { AuthGuard } from '@libs/guards/guard';
import { UserService } from '@libs/services/user/user.service';
import { SocialAuthConfig } from '@libs/common/config/env.config.interface';

import {
  UserRepository,
  UserVerificationRepository,
  DeviceRepository,
  UserDetailsRepository,
  WalletRepository,
  User,
  UserSchema,
  UserVerification,
  UserVerificationSchema,
  UserDetailsSchema,
  UserDetails,
  Device,
  DeviceSchema,
  UserTokenMeta,
  UserTokenMetaSchema,
  UserTokenMetaRepository,
  Wallet,
  WalletSchema,
  roles,
} from '@libs/data-access';
import { S3Module } from '@libs/s3';
import { EmailTemplatePersistenceModule } from '@libs/services/email-template/src/email-template.persistence.module';
import { EmailTemplateRepository } from '@libs/data-access/repositories/email-template.repository';

export interface AuthModuleOptions {
  imports?: any[];
  providers?: Provider[];
  socialAuthConfig?: SocialAuthConfig;
  defaultRole?: string;
}

@Module({})
export class UserAuthModule {
  static forRoot(options: AuthModuleOptions = {}): DynamicModule {
    const { imports = [], providers = [], socialAuthConfig, defaultRole } = options;

    return {
      module: UserAuthModule,
      imports: [
        // ✅ Mongoose models
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: UserVerification.name, schema: UserVerificationSchema },
          { name: UserDetails.name, schema: UserDetailsSchema },
          { name: Device.name, schema: DeviceSchema },
          { name: UserTokenMeta.name, schema: UserTokenMetaSchema },
          { name: Wallet.name, schema: WalletSchema },
        ]),
        S3Module,
        SendGridMailModule,
        EmailTemplatePersistenceModule,

        // ✅ SocialAuthModule with provided config
        socialAuthConfig
          ? SocialAuthModule.forRootAsync({
              useFactory: () => socialAuthConfig,
              inject: [],
            })
          : SocialAuthModule.forRootAsync({
              useFactory: () => ({
                google: {
                  clientId: process.env.GOOGLE_CLIENT_ID || '',
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
                  redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
                  scope: [],
                },
                facebook: {
                  appId: process.env.FACEBOOK_APP_ID || '',
                  appSecret: process.env.FACEBOOK_APP_SECRET || '',
                  redirectUri: process.env.FACEBOOK_REDIRECT_URI || '',
                  scope: [],
                },
              }),
              inject: [],
            }),

        ...imports,
      ],

      controllers: [AuthController],
      providers: [
        AuthService,
        AuthGuard,
        {
          provide: 'AUTH_DEFAULT_ROLE',
          useValue: defaultRole || roles.USER,
        },
        UserService,
        MailService,
        EnvService,
        SetPasswordGuard,
        UserRepository,
        UserVerificationRepository,
        DeviceRepository,
        UserDetailsRepository,
        UserTokenMetaRepository,
        WalletRepository,
        EmailTemplateRepository,
        ...providers,
      ],

      exports: [
        AuthService,
        AuthGuard,
        'AUTH_DEFAULT_ROLE',
        UserService,
        MailService,
        SetPasswordGuard,
        UserRepository,
        UserVerificationRepository,
        DeviceRepository,
        UserDetailsRepository,
        UserTokenMetaRepository,
        MongooseModule,
        EnvService,
        SocialAuthModule,
      ],
    };
  }
}
