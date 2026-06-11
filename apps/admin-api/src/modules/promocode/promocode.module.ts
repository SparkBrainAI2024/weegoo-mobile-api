import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { IssueService } from "@libs/services/issue/src/issue.service";
import { UsersIssueResolver } from "@libs/services/issue/src/resolver/users-issue.resolver";
import { PromoCodePersistenceModule } from "@libs/services/promocode/src/promocode.persistence.module";
import { PromoCodeResolver } from "@libs/services/promocode/src/promocode.resolver";
import { PromoCodeService } from "@libs/services/promocode/src/promocode.service";
import { AdminAuthModule } from "../auth/auth.module";

@Module({
    imports: [
       PromoCodePersistenceModule,
       UserPersistenceModule,
       AdminAuthModule
    ],
    providers: [
        PromoCodeService,
        PromoCodeResolver,
        EnvService
    ],
    exports: [PromoCodeService]
})
export class PromoCodeModule { }
