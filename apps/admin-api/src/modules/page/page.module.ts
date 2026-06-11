import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { IssueService } from "@libs/services/issue/src/issue.service";
import { UsersIssueResolver } from "@libs/services/issue/src/resolver/users-issue.resolver";
import { PageService } from "@libs/services/pages/page.service";
import { PageRepository } from "@libs/data-access/repositories/page.repository";
import { PagePersistenceModule } from "@libs/services/pages/page.persistence.module";

@Module({
    imports: [
        PagePersistenceModule,
        UserPersistenceModule,
    ],
    providers: [
        EnvService,
        PageService
    ],
    exports: [PageService, ]
})
export class PageModule { }
