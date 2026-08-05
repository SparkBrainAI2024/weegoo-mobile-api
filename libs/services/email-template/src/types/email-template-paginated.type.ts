import { ObjectType } from "@nestjs/graphql";
import { Paginated } from "@libs/data-access/base/base.response";
import { EmailTemplate } from "@libs/data-access";

@ObjectType()
export class EmailTemplateListWithPaginationResponse extends Paginated(EmailTemplate) {}