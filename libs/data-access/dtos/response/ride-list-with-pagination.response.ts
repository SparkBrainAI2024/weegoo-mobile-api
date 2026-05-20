import { Paginated } from "@libs/data-access/base/base.response";
import { Rides } from "@libs/data-access/entities/rides.entity";

export class RideListWithPaginationResponse extends Paginated(Rides) {}