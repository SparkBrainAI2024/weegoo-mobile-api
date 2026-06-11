import { ObjectType } from "@nestjs/graphql";
import { Paginated } from "@libs/data-access/base/base.response";
import { Rating } from "@libs/data-access/entities/rating.entity";

@ObjectType()
export class RatingListWithPaginationResponse extends Paginated(Rating) {}