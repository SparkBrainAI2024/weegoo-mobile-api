import { SocialAuthConfig,ErrorException } from '@libs/common';
import { GoogleAuthService } from './services/google-auth.service';
import { HttpModule } from '@nestjs/axios';
import { DynamicModule, HttpStatus, Module } from '@nestjs/common';
import { APPLE_SERVICE, GOOGLE_SERVICE, SOCIAL_AUTH_CONFIG } from './constants';
import { SocialAuthService } from './social-auth.service';
import { EnvService } from '@libs/common/config/env.service';

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
      useFactory: (config: SocialAuthConfig, envService: EnvService) => {
        const googleConfig = config.google;
        if (!googleConfig) {
          throw  ErrorException(
            null,
            'SOCIAL_AUTH.AUTH_CONFIG_NOT_FOUND',
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
        return new GoogleAuthService(config, envService);
      },
      inject: [SOCIAL_AUTH_CONFIG, EnvService],
    };

    return {
      module: SocialAuthModule,
      imports: [HttpModule, ...(options.imports || [])],
      providers: [SocialAuthService, configProvider, googleProvider,EnvService],
      exports: [SocialAuthService],
    };
  }
}
