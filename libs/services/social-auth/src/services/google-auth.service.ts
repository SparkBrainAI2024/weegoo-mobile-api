import { SocialAuthConfig } from '@libs/common/config/env.config.interface';
import { ServerError } from '@libs/common/errors';
import {
  ISocialAuthService,
  SocialAuthResponse,
} from '../interface/social-auth.interface';
import { HttpService } from '@nestjs/axios';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { GOOGLE_TOKEN_INFO_URL, GOOGLE_TOKEN_ISS, SOCIAL_AUTH_CONFIG } from '../constants';
import { ErrorException } from '@libs/common';
import { EnvService } from '@libs/common/config/env.service';

@Injectable()
export class GoogleAuthService implements ISocialAuthService {
  private readonly httpService: HttpService;

  constructor(
    @Inject(SOCIAL_AUTH_CONFIG)
    private readonly config: SocialAuthConfig,
    private readonly envService: EnvService,
  ) {
    this.httpService = new HttpService();
  }

  async validateToken(token: string): Promise<SocialAuthResponse> {
    try {
      const response: any = await this.httpService.axiosRef.get(GOOGLE_TOKEN_INFO_URL, {
        params: {
          id_token: token,
        },
      });
      console.log("🚀 ~ file: google-auth.service.ts:35 ~ GoogleAuthService ~ validateToken ~ response:", response.data)
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const { iss, exp, aud, sub, email, name, picture } = response.data;
      if (GOOGLE_TOKEN_ISS !== iss) {
        throw ErrorException(
          null,
          "SOCIAL-AUTH.TOKEN_ISSUE_PROVIDER_MISMATCH",
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      // if (this.envService.getGoogleClientId() !== aud) {
      //   throw ErrorException(
      //     null,
      //     "SOCIAL-AUTH.CLIENT_ID_NOT_FOUND",
      //     HttpStatus.INTERNAL_SERVER_ERROR
      //   );
      // }
      if (currentTimeInSeconds > parseInt(exp)) {
        throw ErrorException(
          null,
          "SOCIAL-AUTH.EXPIRED_GOOGLE_TOKEN",
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      return {
        providerId: sub,
        email,
        name,
        picture,
      };
    } catch (error) {
      if (error instanceof ServerError) {
        throw error; // Re-throw custom ServerError
      }
      throw ErrorException(
        error,
        "SOCIAL-AUTH.AUTH_CONFIG_NOT_FOUND",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
