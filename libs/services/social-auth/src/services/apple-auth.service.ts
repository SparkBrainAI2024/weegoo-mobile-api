import { Injectable, HttpStatus, Inject, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { createPublicKey } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

import { SocialAuthConfig } from '@libs/common/config/env.config.interface';
import { EnvService } from '@libs/common/config/env.service';
import { ErrorException } from '@libs/common';
import {
  ISocialAuthService,
  SocialAuthResponse,
} from '../interface/social-auth.interface';
import { APPLE_KEYS_URL, APPLE_TOKEN_ISS, SOCIAL_AUTH_CONFIG } from '../constants';

/**
 * Verifies Apple Sign In identity tokens.
 *
 * Apple publishes its public keys at https://appleid.apple.com/auth/keys (JWKS).
 * The identity token is a JWT signed with RS256. We:
 * 1. Read the `kid` from the JWT header (no signature verification yet).
 * 2. Fetch Apple's JWKS and locate the matching public key.
 * 3. Verify the signature, issuer, audience and expiry with `jsonwebtoken`.
 */
@Injectable()
export class AppleAuthService implements ISocialAuthService {
  private readonly httpService: HttpService;
  private keysCache: { keys: Record<string, any>[]; fetchedAt: number } | null = null;

  constructor(
    @Inject(SOCIAL_AUTH_CONFIG)
    private readonly config: SocialAuthConfig,
    private readonly envService: EnvService,
  ) {
    this.httpService = new HttpService();
  }

  async validateToken(token: string): Promise<SocialAuthResponse> {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded?.header?.kid) {
        throw ErrorException(
          null,
          'SOCIAL-AUTH.INVALID_APPLE_TOKEN',
          HttpStatus.BAD_REQUEST,
        );
      }

      const jwks = await this.fetchApplePublicKeys();
      const key = jwks.keys.find(
        (k: Record<string, any>) => k.kid === decoded.header.kid,
      );
      if (!key) {
        throw ErrorException(
          null,
          'SOCIAL-AUTH.APPLE_PUBLIC_KEY_NOT_FOUND',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const publicKey = createPublicKey({ key, format: 'jwk' });

      const appleClientId =
        this.envService.getAppleClientId() || this.config.apple?.clientId || '';

      const payload: any = jwt.verify(token, publicKey, {
        issuer: APPLE_TOKEN_ISS,
        audience: appleClientId,
      });

      return {
        providerId: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    } catch (error) {
      // Re-throw errors raised by ErrorException (HttpException) as-is.
      if (error instanceof HttpException) {
        throw error;
      }
      if (error instanceof TokenExpiredError) {
        throw ErrorException(
          null,
          'SOCIAL-AUTH.EXPIRED_APPLE_TOKEN',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      if (error instanceof JsonWebTokenError) {
        throw ErrorException(
          null,
          'SOCIAL-AUTH.INVALID_APPLE_TOKEN',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw ErrorException(
        error,
        'SOCIAL-AUTH.APPLE_TOKEN_VERIFICATION_FAILED',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async fetchApplePublicKeys() {
    const now = Date.now();
    if (this.keysCache && now - this.keysCache.fetchedAt < 24 * 60 * 60 * 1000) {
      return this.keysCache.keys;
    }
    const response: any = await this.httpService.axiosRef.get(APPLE_KEYS_URL, {
      timeout: 5000,
    });
    this.keysCache = { keys: response.data.keys, fetchedAt: now };
    return response.data.keys;
  }
}
