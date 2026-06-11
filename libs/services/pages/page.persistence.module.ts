import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { IssueService } from "@libs/services/issue/src/issue.service";
import { UsersIssueResolver } from "@libs/services/issue/src/resolver/users-issue.resolver";
import { PageRepository } from "@libs/data-access/repositories/page.repository";
import { Mongoose } from "mongoose";
import { MongooseModule } from "@nestjs/mongoose";
import { Page, PageSchema } from "@libs/data-access/entities/page.entity";

@Module({
    imports: [MongooseModule.forFeature([{ name: Page.name, schema: PageSchema }])

    ],
    providers: [
        PageRepository,
    ],
    exports: [PageRepository]
})
export class PagePersistenceModule { }
