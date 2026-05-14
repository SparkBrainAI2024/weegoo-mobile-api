import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AUTHORIZATION_HEADER, tokenTypes } from "@libs/common/constants";
import { User, UserDocument } from "@libs/data-access";
import { verifyToken } from "@libs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { EnvService } from "@libs/common/config/env.service";

@Injectable()
export class SetPasswordGuard implements CanActivate {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly envService: EnvService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    const authorization = request?.headers?.[AUTHORIZATION_HEADER];

    if (!authorization || typeof authorization !== "string") {
      throw new HttpException(
        "COMMON.INVALID_TOKEN",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authorization.trim();

    const decodedToken: any = await verifyToken(token, this.envService.getJwtSecretKey());
    if (!decodedToken) {
      throw new HttpException(
        "COMMON.INVALID_TOKEN",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (decodedToken.type !== tokenTypes.setPasswordToken) {
      throw new HttpException(
        "COMMON.INVALID_TOKEN",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const haveUser: UserDocument = await this.userModel.findOne({
      _id: decodedToken.id,
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

    // Attach decoded token and user to request for use in resolver/service
    request.verificationTokenData = decodedToken;
    request.user = haveUser;
    request.lang = haveUser.language;

    return true;
  }
}