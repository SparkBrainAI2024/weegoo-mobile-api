import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { PageService } from "@libs/services/pages/page.service";
import { PagePersistenceModule } from "@libs/services/pages/page.persistence.module";
import { AdminAuthModule } from "../auth/auth.module";
import { AdminPageResolver } from "./resolver/admin-page.resolver";

@Module({
    imports: [
        UserPersistenceModule,
        PagePersistenceModule,
        AdminAuthModule
    ],
    providers: [
        EnvService,
        PageService,AdminPageResolver
    ],
    exports: [PageService, ]
})
export class PageModule { }
