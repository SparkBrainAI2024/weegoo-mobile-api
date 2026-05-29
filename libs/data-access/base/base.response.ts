import { Type } from '@nestjs/common';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
  IBaseCursorPaginationResponse,
  IBaseListResponse,
  IBaseResponse,
  IPaginatedResult,
} from '../interfaces/pagination.interface';

@ObjectType()
export class Pagination {
  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  limit: number;

  @Field(() => Boolean, { defaultValue: false })
  hasNextPage: boolean;

  @Field(() => Boolean, { defaultValue: false })
  hasPreviousPage: boolean;

  @Field(() => Int, { nullable: true })
  nextPage?: number;

  @Field(() => Int, { nullable: true })
  previousPage?: number;

  @Field(() => Int)
  total: number;
}

export function Paginated<T>(classRef: Type<T>): Type<IPaginatedResult<T>> {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedType implements IPaginatedResult<T> {
    @Field(() => String, { nullable: true })
    message?: string;

    @Field(() => [classRef], { nullable: true })
    data: T[];

    @Field(() => Pagination)
    pagination: Pagination;
  }

  return PaginatedType as Type<IPaginatedResult<T>>;
}

export function BaseResponse<T>(classRef: Type<T>): Type<IBaseResponse<T>> {
  @ObjectType({ isAbstract: true })
  abstract class BaseResponseType {
    @Field(() => String)
    message: string;

    @Field(() => classRef)
    data: T;
  }

  return BaseResponseType as Type<IBaseResponse<T>>;
}

export function BaseListResponse<T>(classRef: Type<T>): Type<IBaseListResponse<T>> {
  @ObjectType({ isAbstract: true })
  abstract class BaseListResponseType {
    @Field(() => String)
    message: string;

    @Field(() => [classRef], { defaultValue: [] })
    data: T[];
  }

  return BaseListResponseType as Type<IBaseListResponse<T>>;
}


@ObjectType()
export class CursorPageInfo {
  @Field(() => String, { nullable: true })
  nextCursor?: string;

  @Field(() => Boolean)
  hasNextPage: boolean;
}

export function BaseCursorPaginationResponse<T>(classRef: Type<T>): Type<IBaseCursorPaginationResponse<T>> {
  @ObjectType({ isAbstract: true })
  abstract class BaseCursorPaginationType {
    @Field(() => [classRef], { defaultValue: [] })
    data: T[];

    @Field(() => CursorPageInfo)
    pageInfo: CursorPageInfo
  }

  return BaseCursorPaginationType as Type<IBaseCursorPaginationResponse<T>>;
}