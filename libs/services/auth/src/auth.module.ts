import { Module, DynamicModule, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';

import { AuthService } from './auth.service';
import { SetPasswordGuard } from '@libs/guards/set-password.guard';
import { MailService } from '@libs/services/mail';
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
  roles,
} from '@libs/data-access';

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
        ]),

        // ✅ Mailer properly configured using global ConfigService
        MailerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: async (config: ConfigService) => {
            const host = config.get<string>('MAIL_HOST');
            const port = Number(config.get<string>('MAIL_PORT'));
            const user = config.get<string>('MAIL_USER');
            const pass = config.get<string>('MAIL_PASS');

            // Debug: log values
            console.log('[MailerConfig] MAIL_HOST:', host);
            console.log('[MailerConfig] MAIL_PORT:', port);
            console.log('[MailerConfig] MAIL_USER:', user ? '***' : 'NOT SET');
            console.log('[MailerConfig] MAIL_PASS:', pass ? '***' : 'NOT SET');

            if (!host || !port || !user || !pass) {
              console.warn('[MailerConfig] Mail configuration incomplete. Mail functionality will be disabled.');
              // Return a dummy transport to prevent startup errors in dev
              return {
                transport: {
                  host: 'localhost',
                  port: 1025,
                  secure: false,
                  auth: { user: '', pass: '' },
                },
              };
            }

            return {
              transport: {
                host,
                port,
                secure: false,
                auth: { user, pass },
              },
            };
          },
        }),

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
