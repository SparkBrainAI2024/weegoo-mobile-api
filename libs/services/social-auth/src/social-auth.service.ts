import { ServerError } from '@libs/common/errors';
import { SocialAuthResponse } from './interface/social-auth.interface';
import { GoogleAuthService } from './services/google-auth.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { GOOGLE_SERVICE } from './constants';
import { ErrorException } from '@libs/common';

@Injectable()
export class SocialAuthService {
  constructor(

    @Inject(GOOGLE_SERVICE)
    private readonly googleAuthService: GoogleAuthService,
  ) { }

  async verifyToken(token: string, provider: 'apple' | 'google'): Promise<SocialAuthResponse> {
    if (!token) {
      throw ErrorException(
        null,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.NOT_ACCEPTABLE
      );
    }
    if (provider === 'google') {
      return this.googleAuthService.validateToken(token);
    } else if (provider === 'apple') {
      return this.googleAuthService.validateToken(token);
    } else {
      throw ErrorException(
        null,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.NOT_ACCEPTABLE
      );
    }
  }
}
