import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AUTHORIZATION_HEADER, LANG_HEADER, tokenTypes } from "@libs/common/constants";
import { User, UserDocument, UserTokenMetaRepository } from "@libs/data-access";
import { verifyToken } from "@libs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { EnvService } from "@libs/common/config/env.service";
import { language } from "@libs/data-access";

function extractBearerToken(request: any): string | null {
  const authorization = request?.headers?.[AUTHORIZATION_HEADER];

  if (
    authorization &&
    typeof authorization === "string" &&
    authorization.startsWith("Bearer ")
  ) {
    return authorization.substring(7).trim();
  }

  return null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly userTokenMetaRepository: UserTokenMetaRepository,
    private readonly envService: EnvService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    const token = extractBearerToken(request);
    if (request && request.headers && request.headers[LANG_HEADER]) {
      request.lang =
        request.headers[LANG_HEADER] === language.NP
          ? language.NP
          : language.EN;
    }
    if (token) {
      const isVerifiedToken: any = await verifyToken(token, this.envService.getJwtSecretKey());
      if (!isVerifiedToken) {
        throw new HttpException(
          "COMMON.INVALID_TOKEN",
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (isVerifiedToken.type !== tokenTypes.accessToken) {
        throw new HttpException(
          "COMMON.INVALID_TOKEN",
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Match JTI existence in database
      const tokenMeta = await this.userTokenMetaRepository.findByAccessTokenJti(isVerifiedToken.jti);
      if (!tokenMeta) {
        throw new HttpException(
          "COMMON.INVALID_TOKEN",
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (isVerifiedToken.sessionId) {
        request.sessionId = isVerifiedToken.sessionId;
      } else {
        request.sessionId = null;
      }
      const haveUser: UserDocument = await this.userModel.findOne({
        _id: isVerifiedToken.id,
      });
      if (!haveUser) {
        throw new HttpException(
          "COMMON.USER_NOT_FOUND",
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (haveUser.suspended) {
        throw new HttpException("COMMON.SUSPENDED", HttpStatus.UNAUTHORIZED);
      }
      if (!haveUser.verified) {
        throw new HttpException(
          "COMMON.USER_NOT_VERIFIED",
          HttpStatus.UNAUTHORIZED,
        );
      }
      request.user = haveUser;
      request.lang = haveUser.language;
      return true;
    } else {
      throw new HttpException("COMMON.UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    }
  }
}

@Injectable()
export class LangGuard implements CanActivate {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly envService: EnvService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    let defaultLanguage = language.NP;
    const token = extractBearerToken(request);

    if (request && request.headers && request.headers[LANG_HEADER]) {
      request.lang =
        request.headers[LANG_HEADER] === language.NP
          ? language.NP
          : language.EN;
    }
    if (token) {
      const isVerifiedToken: any = await verifyToken(token, this.envService.getJwtSecretKey());
      if (!isVerifiedToken) {
        request.lang = defaultLanguage;
        return true;
      }
      if (isVerifiedToken.type !== tokenTypes.accessToken) {
        request.lang = defaultLanguage;
        return true;
      }
      const haveUser: UserDocument = await this.userModel.findOne({
        _id: isVerifiedToken.id,
      });
      if (!haveUser) {
        request.lang = defaultLanguage;
        return true;
      }
      request.lang = haveUser.language;
    }
    return true;
  }
}
