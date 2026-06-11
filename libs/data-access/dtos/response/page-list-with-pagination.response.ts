import { ObjectType } from "@nestjs/graphql";
import { Paginated } from "@libs/data-access/base/base.response";
import { Page } from "@libs/data-access/entities/page.entity";

@ObjectType()
export class PageListWithPaginationResponse extends Paginated(Page) {}