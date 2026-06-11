import { Module } from "@nestjs/common";
import { PageRepository } from "@libs/data-access/repositories/page.repository";
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
