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

    this.logger.debug(`Incoming request: ${request?.method} ${request?.url}`);

    const token = extractBearerToken(request);
    if (!token) {
      this.logger.debug('No bearer token found in authorization header');
      throw new HttpException("COMMON.UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    }
    this.logger.debug('Bearer token extracted successfully');

    // 1. Verify JWT
    const isVerifiedToken: any = await verifyToken(
      token,
      this.envService.getJwtSecretKey(),
    );
    if (!isVerifiedToken) {
      this.logger.debug('JWT verification failed — invalid or malformed token');
      throw new HttpException("COMMON.INVALID_TOKEN", HttpStatus.UNAUTHORIZED);
    }
    this.logger.debug(`JWT verified — id: ${isVerifiedToken.id}, role: ${isVerifiedToken.role}, type: ${isVerifiedToken.type}, jti: ${isVerifiedToken.jti}`);

    // 2. Must be access token
    if (isVerifiedToken.type !== tokenTypes.accessToken) {
      this.logger.debug(`Token type mismatch — expected: ${tokenTypes.accessToken}, got: ${isVerifiedToken.type}`);
      throw new HttpException("COMMON.INVALID_TOKEN", HttpStatus.UNAUTHORIZED);
    }
    this.logger.debug('Token type check passed');

    // 3. Must be admin role
    if (isVerifiedToken.role !== roles.ADMIN) {
      this.logger.debug(`Role mismatch — expected: ${roles.ADMIN}, got: ${isVerifiedToken.role}`);
      throw new HttpException("COMMON.UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    }
    this.logger.debug('Role check passed');

    // 4. Check JTI exists in DB
    const tokenMeta = await this.userTokenMetaRepository.findByAccessTokenJti(
      isVerifiedToken.jti,
    );
    if (!tokenMeta) {
      this.logger.debug(`JTI not found in DB — jti: ${isVerifiedToken.jti} — token may be revoked or logged out`);
      throw new HttpException("COMMON.INVALID_TOKEN", HttpStatus.UNAUTHORIZED);
    }
    this.logger.debug(`JTI found in DB — tokenMetaId: ${tokenMeta._id}`);

    // 5. Check admin exists in DB
    const admin = await this.adminUserRepository.findOne({
      _id: isVerifiedToken.id,
    });
    if (!admin) {
      this.logger.debug(`Admin not found in DB — id: ${isVerifiedToken.id}`);
      throw new HttpException("COMMON.USER_NOT_FOUND", HttpStatus.UNAUTHORIZED);
    }
    this.logger.debug(`Admin found — id: ${admin._id}`);

    // 6. Attach admin to request
    request.user = admin;
    this.logger.debug('Admin attached to request — guard passed');
    return true;
  }
}