import { CursorPageInfo } from "../base/base.response";

export interface IBaseResponse<T> {
  message: string;
  data: T;
}

export interface IBaseListResponse<T> {
  message: string;
  data: T[];
}

export interface IBaseCursorPaginationResponse<T> {
  message: string;
  data: T[];
  pageInfo: CursorPageInfo;
}


export interface IPaginationRequest {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

export interface IPagination {
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage?: number;
  previousPage?: number;
  total: number;
}

export interface IPaginatedResult<T> {
  message?: string;
  data: T[];
  pagination: IPagination;
}

// Reusable single $lookup definition
export interface LookupStage {
  from: string;
  localField: string;
  foreignField: string;
  as: string;
}

export interface LookupWithSearchOptions {
  page?: number;
  limit?: number;
  baseMatch?: Record<string, any>; // Match on base document
  searchText?: string; // Text search on base fields
  searchKeys?: Record<string, any>; // Regex search on base & joined fields
  sort?: Record<string, 1 | -1>;
  /**
   * @deprecated Use `lookups` field instead.
   * Keeping for backward compatibility.
   * Accepts either a single lookup or an array which will be merged into `lookups`.
   */
  lookup?: LookupStage;
  // New: support multiple lookups
  lookups?: LookupStage[];
  // Optional $set aggregation stage(s) to add/overwrite fields
  // Accepts a single $set object or an array of $set objects to be applied in order
  set?: Record<string, any> | Array<Record<string, any>>;
  // Optional $unset aggregation stage to remove fields
  // Accepts a single field or an array of field names
  unset?: string | string[];

  /**
   * Optional $project aggregation stage to reshape the documents
   * Accepts a single $project object or an array of $project objects to be applied in order
   */
  project?: Record<string, any>;

  /**
   * Optional $skipSoftDelete flag to include soft-deleted documents
   */
  skipSoftDelete?: boolean;
}

export interface FilterSearchOptions {
  page?: number;
  limit?: number;
  baseMatch?: Record<string, any>; // Match on base document
  searchText?: string; // Text search on base fields
  searchKeys?: Record<string, any>; // Regex search on base & joined fields
  sort?: Record<string, 1 | -1>;
  project?: Record<string, any>;
  skipSoftDelete?: boolean; // <-- New Option
}
