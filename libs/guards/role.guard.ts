import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { roles } from '@libs/data-access';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<roles[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    console.log('Required Roles for this route:', requiredRoles);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user = request?.user;

    // Checks if the user's active session role (loginAs) is within the allowed roles
    return user && requiredRoles.includes(user.loginAs as roles);
  }
}