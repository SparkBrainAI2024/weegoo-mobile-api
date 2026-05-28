import {
  Document,
  Model,
  MongooseBaseQueryOptions,
  PipelineStage,
  RootFilterQuery,
} from 'mongoose';
import {
  IPaginatedResult,
  IPaginationRequest,
  LookupWithSearchOptions,
} from '../interfaces/pagination.interface';
import { CursorPaginationInput } from './base.input';
import { Populate } from './base.repository';

export interface BaseModel<T extends Document> extends Model<T> {
  /**
   * Soft delete a document by setting the `deleted` field to true.
   * @param filter - The filter to find the document(s) to soft-delete.
   * @param options - Additional options for the query.
   */
  softDelete(filter?: RootFilterQuery<T>, options?: MongooseBaseQueryOptions<T>): Promise<T>;

  /**
   * Soft delete multiple documents by setting the `deleted` field to true.
   * @param filter - The filter to find the document(s) to soft-delete.
   * @param options - Additional options for the query.
   */
  softDeleteMany(filter?: RootFilterQuery<T>, options?: MongooseBaseQueryOptions<T>): Promise<void>;

  /**
   * Restore a soft-deleted document by setting the `deleted` field to false.
   * @param filter - The filter to find the document(s) to restore soft delete.
   * @param options - Additional options for the query.
   */
  restore(filter?: RootFilterQuery<T>, options?: MongooseBaseQueryOptions<T>): Promise<T>;

  /**
   * Restore multiple soft-deleted documents by setting the `deleted` field to false.
   * @param filter - The filter to find the document(s) to restore soft delete.
   * @param options - Additional options for the query.
   */
  restoreMany(filter?: RootFilterQuery<T>, options?: MongooseBaseQueryOptions<T>): Promise<void>;

  /**
   * Paginate documents based on the provided request and filter.
   * @param request
   * @param filter - The filter to find the document(s) to paginate.
   * @param options - Additional options for the query.
   */
  paginate(
    request: IPaginationRequest,
    filter?: RootFilterQuery<T>,
    options?: MongooseBaseQueryOptions<T>,
  ): Promise<IPaginatedResult<T>>;

  /**
   * Paginate documents with lookups and search capabilities.
   * @param options - The options for pagination, including lookups and search fields.
   * @return A promise that resolves to a paginated result.
   */
  paginationWithLookUps(options: LookupWithSearchOptions): Promise<IPaginatedResult<T>>;

  /**
   * Paginate documents based on the provided request, filter, and aggregation pipelines.
   * @param request - The pagination request containing page, limit, and sort.
   * @param filter - The filter to find the document(s) to paginate.
   * @param options - Additional options for the query.
   * @param pipelines - Aggregation pipelines to apply before pagination.
   */
  paginateAggregate(
    request: IPaginationRequest,
    filter?: RootFilterQuery<T>,
    options?: MongooseBaseQueryOptions<T>,
    pipelines?: PipelineStage[],
  ): Promise<IPaginatedResult<T>>;

  /**Cursor-based pagination */
  cursorPaginate(
    filter: RootFilterQuery<T>,
    pagination: CursorPaginationInput,
    populate?: Populate,
  ): Promise<IPaginatedResult<T>>;
}
