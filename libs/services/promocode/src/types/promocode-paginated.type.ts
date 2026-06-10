// dto/promo-code-paginated.type.ts
import { PromoCode } from '@libs/data-access';
import { PaginatedResponseType } from '@libs/data-access/base/paginated-response.type';
import { ObjectType } from '@nestjs/graphql';


@ObjectType() // concrete named type — registered in GraphQL schema as "PromoCodePaginatedResult"
export class PromoCodePaginatedResult extends PaginatedResponseType(PromoCode) {}