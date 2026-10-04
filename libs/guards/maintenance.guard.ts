import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { MaintenanceInfoService } from "@libs/services/maintenance-info/maintenance-info.service";
import { LANG_HEADER } from "@libs/common/constants";

/**
 * Maintenance guard.
 *
 * Applied on the login / signup auth mutations. Throws HTTP 503 (Service
 * Unavailable) with the maintenance message stored in the database whenever
 * maintenance mode is switched on, so no user can log in or register while
 * the app is down for maintenance.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly maintenanceInfoService: MaintenanceInfoService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let lang: string | undefined;
    try {
      const ctx = GqlExecutionContext.create(context);
      const request = ctx.getContext()?.req;
      lang =
        request?.lang ||
        (request?.headers?.[LANG_HEADER] === "NP" ? "NP" : undefined);
    } catch {
      // Not a graphql context (plain http) - fall back to default language.
    }

    await this.maintenanceInfoService.assertNotInMaintenance(lang);
    return true;
  }
}