import { Field, ObjectType } from "@nestjs/graphql";
import { Remark } from "@libs/data-access/entities/remark.entity";
import { Paginated } from "@libs/data-access/base/base.response";

@ObjectType()
export class RemarkListWithPaginationResponse extends Paginated(Remark) {}