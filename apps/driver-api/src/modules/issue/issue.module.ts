import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { IssueService } from "@libs/services/issue/src/issue.service";
import { UsersIssueResolver } from "@libs/services/issue/src/resolver/users-issue.resolver";

@Module({
    imports: [
        IssuePersistenceModule,
        UserPersistenceModule,
    ],
    providers: [
        IssueService,
        UsersIssueResolver,
        EnvService,
    ],
    exports: [IssueService]
})
export class IssueModule { }
