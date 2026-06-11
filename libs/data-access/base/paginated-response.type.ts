// libs/common/base/paginated-response.type.ts
import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Type } from '@nestjs/common';

// Pagination meta — reused across all paginated responses
@ObjectType()
export class PaginationMeta {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;

  @Field(() => Int, { nullable: true })
  nextPage?: number;

  @Field(() => Int, { nullable: true })
  previousPage?: number;
}

// Generic factory — call this once per entity that needs pagination
export function PaginatedResponseType<T>(ItemType: Type<T>) {
  @ObjectType({ isAbstract: true }) // isAbstract: true — same reason as BaseEntity
  abstract class PaginatedType {
    @Field(() => [ItemType])
    data: T[];

    @Field(() => PaginationMeta)
    pagination: PaginationMeta;
  }

  return PaginatedType;
}