import { ObjectType } from "@nestjs/graphql";
import { BaseCursorPaginationResponse } from "@libs/data-access/base/base.response";
import { RideGroup } from "./ride-group.response";

@ObjectType()
export class RidesListWithCursorPaginationResponse extends BaseCursorPaginationResponse(RideGroup) {}