import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AUTHORIZATION_HEADER, tokenTypes } from "@libs/common/constants";
import { verifyToken } from "@libs/common";
import { EnvService } from "@libs/common/config/env.service";
import { UserTokenMetaRepository } from "@libs/data-access";
import { roles } from "@libs/data-access";
import { AdminUserRepository } from "@libs/data-access/repositories/admin-user.repository";

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
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);

  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    private readonly userTokenMetaRepository: UserTokenMetaRepository,
    private readonly envService: EnvService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;


    const token = extractBearerToken(request);
    if (!token) {
      throw new HttpException("COMMON.UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    }

    // 1. Verify JWT
    const isVerifiedToken: any = await verifyToken(
      token,
      this.envService.getJwtSecretKey(),
    );
    if (!isVerifiedToken) {
      throw new HttpException("COMMON.INVALID_TOKEN", HttpStatus.UNAUTHORIZED);
    }

    // 2. Must be access token
    if (isVerifiedToken.type !== tokenTypes.accessToken) {
      throw new HttpException("COMMON.INVALID_TOKEN", HttpStatus.UNAUTHORIZED);
    }

    // 3. Must be admin role
    if (isVerifiedToken.role !== roles.ADMIN) {
      throw new HttpException("COMMON.UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    }

    // 4. Check JTI exists in DB
    const tokenMeta = await this.userTokenMetaRepository.findByAccessTokenJti(
      isVerifiedToken.jti,
    );
    if (!tokenMeta) {
      throw new HttpException("COMMON.INVALID_TOKEN", HttpStatus.UNAUTHORIZED);
    }

    // 5. Check admin exists in DB
    const admin = await this.adminUserRepository.findOne({
      _id: isVerifiedToken.id,
    });
    if (!admin) {
      throw new HttpException("COMMON.USER_NOT_FOUND", HttpStatus.UNAUTHORIZED);
    }

    // 6. Attach admin to request
    request.user = admin;
    return true;
  }
}