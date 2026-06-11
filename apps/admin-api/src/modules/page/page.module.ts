import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { PageService } from "@libs/services/pages/page.service";
import { PagePersistenceModule } from "@libs/services/pages/page.persistence.module";
import { PageResolver } from "@libs/services/pages/resolver/page.resolver";
import { AdminAuthModule } from "../auth/auth.module";

@Module({
    imports: [
        UserPersistenceModule,
        PagePersistenceModule,
        AdminAuthModule
    ],
    providers: [
        EnvService,
        PageService,PageResolver
    ],
    exports: [PageService, ]
})
export class PageModule { }
