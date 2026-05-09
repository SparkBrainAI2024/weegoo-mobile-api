import { escapeRegex } from '@libs/common/helpers/mongo-helper';
import {
  AnyKeys,
  Document,
  FilterQuery,
  InsertManyOptions,
  MongooseUpdateQueryOptions,
  PipelineStage,
  PopulateOptions,
  ProjectionType,
  QueryOptions,
  Types,
  UpdateQuery,
  UpdateWithAggregationPipeline,
} from 'mongoose';

import { IPaginatedResult, IPaginationRequest } from '../interfaces/pagination.interface';
import { PaginationInput } from './base.input';
import { BaseModel } from './base.model';

export type Populate = string | string[] | PopulateOptions | PopulateOptions[];

/**
 *
 * @template T - The type of the document.
 * @extends Document - Mongoose Document type.
 * @class BaseRepository
 * @description This class serves as a base repository for all models, providing common CRUD operations.
 * It includes methods for creating, reading, updating, deleting, and aggregating documents.
 * It also supports pagination, soft deletion, and restoration of documents.
 */
export class BaseRepository<T extends Document> {
  /**
   * Creates an instance of BaseRepository.
   * @param model - The Mongoose model to be used for database operations.
   */
  constructor(protected readonly model: BaseModel<T>) {}

  get searchKeys(): string[] {
    return [];
  }

  /**
   * Creates a new document in the database.
   * @param doc Document to be created
   * @returns Promise<T>
   */
  async create(doc: Partial<T>, populate?: Populate): Promise<T> {
    const result = await this.model.create(doc);
    if (populate) {
      if (typeof populate === 'string' || Array.isArray(populate)) {
        return result.populate(populate);
      }
      return result.populate(populate as PopulateOptions);
    }
    return result;
  }

  /**
   * Creates multiple documents in the database.
   * @param docs Array of documents to be created
   * @returns Promise<any>
   */
  async createMany(
    docs: AnyKeys<T>[] | T[],
    populate?: Populate,
    options?: InsertManyOptions & { lean: true },
  ): Promise<T[]> {
    const entities = docs.map((item: any) => new this.model(item));
    options = this.mergePopulateOptions({}, populate);
    return this.model.insertMany(entities, options);
  }

  /**
   * Finds a single document based on the provided filter.
   * @param filter - The filter to match the document.
   * @param projection - Optional projection to select specific fields.
   * @param options - Optional query options.
   * @returns A promise that resolves to the found document or null if not found.
   */
  async findOne(
    filter?: FilterQuery<T>,
    populate?: Populate,
    projection?: ProjectionType<T> | null,
    options?: QueryOptions<T> | null,
  ): Promise<T | null> {
    options = this.mergePopulateOptions(options, populate);
    console.log("🚀 ~ file: base.repository.ts:122 ~ BaseRepository ~ findOne ~ options:", filter)
    return this.model.findOne(filter, projection, options);
  }

  /**
   * Finds a document by its ID.
   * @param id - The ID of the document to find.
   * @param projection - Optional projection to select specific fields.
   * @param options - Optional query options.
   * @returns A promise that resolves to the found document or null if not found.
   */
  async findById(
    _id: Types.ObjectId,
    populate?: Populate,
    projection?: ProjectionType<T> | null,
    options?: QueryOptions<T> | null,
  ): Promise<T | null> {
    options = this.mergePopulateOptions(options, populate);
    return this.model.findById(_id, projection, options);
  }

  /**
   * Finds multiple documents based on the provided filter.
   * @param filter - The filter to match documents.
   * @param projection - Optional projection to select specific fields.
   * @param options - Optional query options.
   * @returns A promise that resolves to an array of documents matching the filter.
   */
  async find(
    filter?: FilterQuery<T>,
    populate?: Populate,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    options = this.mergePopulateOptions(options, populate);
    return await this.model.find(filter, projection, options);
  }

  /**
   * Updates a single document based on the provided filter.
   * @param filter - The filter to match the document to update.
   * @param update - The update operation to perform.
   * @param options - Optional update options.
   * @returns A promise that resolves to the result of the update operation.
   */
  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T> | UpdateWithAggregationPipeline,
    options?: MongooseUpdateQueryOptions<T> | null,
  ): Promise<any> {
    return this.model.updateOne(filter, update, options);
  }

  /**
   * Finds a single document and updates it based on the provided filter.
   * @param filter - The filter to match the document to update.
   * @param update - The update operation to perform.
   * @param options - Optional query options.
   * @returns A promise that resolves to the updated document or null if not found.
   */
  async findOneAndUpdate(
    filter: FilterQuery<T>,
    update: UpdateQuery<T> | UpdateWithAggregationPipeline,
    options?: QueryOptions<T> | null,
    populate?: Populate,
  ): Promise<T | null> {
    options = {
      ...options,
      new: true, // Return the updated document
    };
    options = this.mergePopulateOptions(options, populate);
    return this.model.findOneAndUpdate(filter, update, options);
  }

  /**
   * Updates multiple documents based on the provided filter.
   * @param filter - The filter to match documents to update.
   * @param update - The update operation to perform.
   * @param options - Optional update options.
   * @returns A promise that resolves to the result of the update operation.
   */
  async updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T> | UpdateWithAggregationPipeline,
    options?: MongooseUpdateQueryOptions<T>,
  ) {
    return this.model.updateMany(filter, update, options);
  }

  /**
   * Updates a document by its ID.
   * @param id - The ID of the document to update.
   * @param update - The update operation to perform.
   * @param options - Optional query options.
   * @returns A promise that resolves to the updated document or null if not found.
   */
  async updateById(
    _id: Types.ObjectId,
    update: UpdateQuery<T> | UpdateWithAggregationPipeline,
    populate?: Populate,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    options = {
      ...options,
      new: true, // Return the updated document
    };
    options = this.mergePopulateOptions(options, populate);
    return this.model.findByIdAndUpdate(_id, update, options);
  }

  /**
   * Deletes a single document based on the provided filter.
   * @param filter - The filter to match the document to delete.
   * @param options - Optional update options.
   * @returns A promise that resolves to the result of the delete operation.
   */
  async deleteOne(filter?: FilterQuery<T>, options?: MongooseUpdateQueryOptions<T>): Promise<any> {
    return this.model.deleteOne(filter, options);
  }

  /**
   * Deletes a document by its ID.
   * @param id - The ID of the document to delete.
   * @param options - Optional query options.
   * @returns A promise that resolves to the deleted document or null if not found.
   */
  async deleteById(_id: Types.ObjectId, options?: QueryOptions<T>): Promise<T | null> {
    return this.model.findByIdAndDelete(_id, options);
  }

  /**
   * Deletes multiple documents based on the provided filter.
   * @param filter - The filter to match documents to delete.
   * @param options - Optional update options.
   * @returns A promise that resolves to the result of the delete operation.
   */
  async deleteMany(filter?: FilterQuery<T>, options?: MongooseUpdateQueryOptions<T>): Promise<any> {
    return this.model.deleteMany(filter, options);
  }

  /**
   * Aggregates documents based on the provided pipeline stages.
   * @param stages - An array of aggregation pipeline stages.
   * @returns A promise that resolves to the aggregated results.
   */
  async aggregate(stages: PipelineStage[], options: any = {}): Promise<any[]> {
    return this.model.aggregate(stages, options);
  }

  /**
   * Soft deletes a document based on the provided filter.
   * @param filter - The filter to match documents to soft delete.
   * @param options - Optional update options.
   * @returns A promise that resolves to the result of the soft delete operation.
   */
  async softDelete(filter: FilterQuery<T>, options?: MongooseUpdateQueryOptions<T>): Promise<any> {
    return this.model.softDelete(filter, options);
  }

  /**
   * Soft deletes a document by its ID.
   * @param id - The ID of the document to soft delete.
   * @param options - Optional update options.
   * @returns A promise that resolves to the result of the soft delete operation.
   */
  async softDeleteById(_id: Types.ObjectId, options?: MongooseUpdateQueryOptions<T>): Promise<any> {
    return this.model.softDelete({ _id }, options);
  }

  /**
   * Soft deletes multiple documents based on the provided filter.
   * @param filter - The filter to match documents to soft delete.
   * @returns A promise that resolves to the result of the soft delete operation.
   */
  async softDeleteMany(filter?: FilterQuery<T>): Promise<void> {
    return this.model.softDeleteMany(filter);
  }

  /**
   * Restores soft-deleted documents based on the provided filter.
   * @param filter - The filter to match documents to restore.
   * @param options - Optional update options.
   * @returns A promise that resolves to the result of the restore operation.
   */
  async restore(
    filter: FilterQuery<T>,
    populate?: Populate,
    options?: MongooseUpdateQueryOptions<T>,
  ): Promise<any> {
    options = this.mergePopulateOptions(options, populate);
    return this.model.restore(filter, options);
  }

  /**
   * Restores a soft-deleted document by its ID.
   * @param id - The ID of the document to restore.
   * @param options - Optional update options.
   * @returns A promise that resolves to the restored document or null if not found.
   */
  async restoreById(
    _id: Types.ObjectId,
    populate?: Populate,
    options?: MongooseUpdateQueryOptions<T>,
  ): Promise<T | null> {
    options = this.mergePopulateOptions(options, populate);
    return this.model.restore({ _id }, options);
  }

  /**
   * Restores multiple soft-deleted documents based on the provided filter.
   * @param filter - The filter to match documents to restore.
   * @returns A promise that resolves to the result of the restore operation.
   */
  async restoreMany(
    filter?: FilterQuery<T>,
    populate?: Populate,
    options?: MongooseUpdateQueryOptions<T>,
  ): Promise<void> {
    options = this.mergePopulateOptions(options, populate);
    return this.model.restoreMany(filter, options);
  }

  /**
   * Paginates the results based on the provided PaginationInput.
   * @param pageInput - The input containing pagination, sorting, searching, and filtering options.
   * @returns A promise that resolves to a PaginatedResponseType containing the paginated data and page info.
   */
  async paginate(
    pageInput: PaginationInput,
    populate?: Populate,
    filter?: FilterQuery<T>,
    options?: QueryOptions<T>,
  ): Promise<IPaginatedResult<T>> {
    const { page, limit, order, searchText, orderBy } = pageInput;
    // Default values for pagination
    const request: IPaginationRequest = {
      page: page || 0,
      limit: limit || 5,
    };

    //  Handle sorting
    if (order) {
      request.sort = {
        [orderBy || '_id']: order, // Default to sorting by _id if no orderBy is provided
      };
    }

    if (searchText && this.searchKeys.length > 0) {
      const decodedText = decodeURIComponent(searchText);
      let _searchKeys = this.searchKeys;

      if (_searchKeys.includes('email')) {
        // remove email from searchKeys
        _searchKeys = _searchKeys.filter((key) => key !== 'email');
        filter = {
          ...filter,
          $or: [
            ..._searchKeys.map((key) => ({ [key]: { $regex: decodedText, $options: 'i' } })),
            { email: { $regex: escapeRegex(decodedText), $options: 'i' } },
          ],
        };
      } else {
        filter = {
          ...filter,
          $or: this.searchKeys.map((key) => ({ [key]: { $regex: decodedText, $options: 'i' } })),
        };
      }
    }

    // Handle filtering
    if (pageInput.filter) {
      const { slugs, ...otherFilters } = pageInput.filter;

      // Handle specific slugs filter condition
      if (slugs && Array.isArray(slugs)) {
        filter = {
          ...filter,
          ...otherFilters,
          slug: { $in: slugs },
        };
      } else {
        filter = {
          ...filter,
          ...pageInput.filter,
        };
      }
    }

    options = this.mergePopulateOptions(options, populate);
    // Ensure pageInfo is defined and has the necessary properties
    return await this.model.paginate(request, filter, options);
  }

  /**
   * Merges populate options with existing options.
   * @param options - Existing options to merge with.
   * @param populate - Populate options to merge.
   * @returns Merged options.
   */
  protected mergePopulateOptions(options?: any, populate?: Populate): any {
    if (!options) {
      options = {};
    }
    if (options.populate) {
      delete options.populate; // Remove existing populate to avoid conflicts
    }
    if (populate) {
      if (this.checkIsString(populate) || Array.isArray(populate)) {
        options['populate'] = populate; // Ensure options has the populate key
      } else {
        options['populate'] = populate as PopulateOptions; // Ensure options has the populate key
      }
    }
    return options;
  }

  private checkIsString(value: Populate) {
    return typeof value === 'string' && value.trim() !== '';
  }

  /**
   * Counts the number of documents based on the provided filter.
   * @param filter - The filter to match documents.
   * @returns A promise that resolves to the count of documents matching the filter.
   */
  async count(filter?: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(filter);
  }

  /**
   * Retrieves an array of distinct values for the given field.
   * @param field - The field to retrieve distinct values for.
   * @param filter - Optional filter to apply to the distinct query.
   * @returns A promise that resolves to an array of distinct values.
   */
  async distinct(field: string, filter?: FilterQuery<T>): Promise<any[]> {
    return this.model.distinct(field, filter);
  }
}
