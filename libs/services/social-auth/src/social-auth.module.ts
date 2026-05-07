import { SocialAuthConfig,ServerError } from '@libs/common';
import { GoogleAuthService } from './services/google-auth.service';
import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';
import { APPLE_SERVICE, GOOGLE_SERVICE, SOCIAL_AUTH_CONFIG } from './constants';
import { SocialAuthService } from './social-auth.service';

@Module({})
export class SocialAuthModule {
  static forRootAsync(options: {
    useFactory: (...args: any) => SocialAuthConfig | Promise<SocialAuthConfig>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    const configProvider = {
      provide: SOCIAL_AUTH_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject,
    };

    const googleProvider = {
      provide: GOOGLE_SERVICE,
      useFactory: (config: SocialAuthConfig) => {
        const googleConfig = config.google;
        if (!googleConfig) {
          throw new ServerError('SOCIAL_AUTH.AUTH_CONFIG_NOT_FOUND');
        }
        return new GoogleAuthService(config);
      },
      inject: [SOCIAL_AUTH_CONFIG],
    };

    return {
      module: SocialAuthModule,
      imports: [HttpModule, ...(options.imports || [])],
      providers: [SocialAuthService, configProvider, googleProvider],
      exports: [SocialAuthService],
    };
  }
}
