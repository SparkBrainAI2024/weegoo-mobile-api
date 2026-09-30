import { ObjectType } from "@nestjs/graphql";
import { Paginated } from "@libs/data-access/base/base.response";
import { Location } from "@libs/data-access/entities/location.entity";

@ObjectType()
export class LocationListWithPaginationResponse extends Paginated(Location) {}
