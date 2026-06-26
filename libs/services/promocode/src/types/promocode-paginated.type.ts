

import { ObjectType } from "@nestjs/graphql";
import { Paginated } from "@libs/data-access/base/base.response";
import { Rides } from "@libs/data-access/entities/rides.entity";
import { Occasion, PromoCode } from "@libs/data-access";

@ObjectType()
export class PromocodeListWithPaginationResponse extends Paginated(PromoCode
    
) {}

export class OcassionListWithPaginationResponse extends Paginated(Occasion){}