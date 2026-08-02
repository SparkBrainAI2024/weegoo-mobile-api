import { escapeRegex } from "@libs/common/helpers/mongo-helper";
import { PipelineStage, Schema } from "mongoose";
import {
  IPaginationRequest,
  LookupStage,
  LookupWithSearchOptions,
} from "../interfaces/pagination.interface";

export function paginateAndSoftDelete(schema: Schema, options: any = {}): void {
  if (!schema || !(schema instanceof Schema)) {
    throw new Error("Mongoose plugin requires a valid Schema instance");
  }

  // enable timestamps on the schema
  schema.set("timestamps", true);
  schema.set("virtuals", true);

  // if options.skipSoftDelete is provided, set it on the schema
  schema.add({
    deletedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
  });

  // Soft delete instance method
  schema.methods.softDelete = async function (filter = {}, options = {}) {
    this.deleted = true;
    this.deletedAt = new Date();
    return this.save(filter, options);
  };

  // Soft delete instance method
  schema.methods.softDeleteMany = async function (filter = {}, options = {}) {
    const update = {
      $set: {
        deleted: true,
        deletedAt: new Date(),
      },
    };
    await this.updateMany(filter, update, options);
  };

  // Static method for soft delete
  schema.statics.softDelete = async function (
    filter: any = {},
    options: any = {},
  ) {
    const update = {
      $set: {
        deleted: true,
        deletedAt: new Date(),
      },
    };
    return this.updateMany(filter, update, options);
  };

  // Restore instance method
  schema.methods.restore = async function (filter = {}, options = {}) {
    this.deleted = false;
    this.deletedAt = null;
    return this.save(filter, options);
  };

  // Restore instance method
  schema.methods.restoreMany = async function (filter = {}, options = {}) {
    const update = {
      $set: {
        deleted: false,
        deletedAt: null,
      },
    };
    await this.updateMany(filter, update, options);
  };

  // Static method for restore
  schema.statics.restore = async function (
    filter: any = {},
    options: any = {},
  ) {
    const update = {
      $set: {
        deleted: false,
        deletedAt: null,
      },
    };
    return this.updateMany(filter, update, options);
  };

  // Pagination method for instance and static
  schema.methods.paginate = async function (
    request: IPaginationRequest,
    filter: any = {},
    options: any = {},
  ) {
    return paginateFind.call(this, request, filter, options);
  };

  schema.statics.paginate = async function (
    request: IPaginationRequest,
    filter: any = {},
    options: any = {},
  ) {
    return paginateFind.call(this, request, filter, options);
  };

  // Pagination method for aggregate queries
  schema.methods.paginateAggregate = async function (
    request: IPaginationRequest,
    filter: any = {},
    pipelines: PipelineStage[] = [],
  ) {
    return await executeAggregationWithPagination.call(
      this,
      pipelines,
      request,
      filter,
    );
  };

  /**
   * Paginated lookup with search functionality
   * @param options - Options for the lookup and search
   * @returns  Paginated results with lookup and search applied
   */
  schema.methods.paginationWithLookUps = async function (
    options: LookupWithSearchOptions,
  ) {
    return await lookupWithSearch.call(this, options);
  };

  /**
   * Paginated lookup with search functionality
   * @param options - Options for the lookup and search
   * @returns  Paginated results with lookup and search applied
   */
  schema.statics.paginationWithLookUps = async function (
    options: LookupWithSearchOptions,
  ) {
    return await lookupWithSearch.call(this, options);
  };

  // Static method for paginated aggregation
  schema.statics.paginateAggregate = async function (
    request: IPaginationRequest,
    filter: any = {},
    pipeline: PipelineStage[] = [],
  ) {
    return await executeAggregationWithPagination.call(
      this,
      pipeline,
      request,
      filter,
    );
  };

  async function executeAggregationWithPagination(
    this: any,
    pipelines: any[],
    request: IPaginationRequest,
    filter: any,
  ) {
    // Ensure the pipeline is an array
    if (!Array.isArray(pipelines)) {
      throw new Error("Pipeline must be an array");
    }

    // Destructure pagination parameters from the request
    const { page = 0, limit = 5, sort = {} } = request;

    // Ensure page and limit are numbers
    const pageNumber = Math.max(0, parseInt(page.toString(), 10));
    const limitNumber = Math.max(1, parseInt(limit.toString(), 10));
    const skip = pageNumber * limitNumber;

    // Add soft delete filter to the pipeline
    const skipDeleted = this.getOptions
      ? this.getOptions().skipSoftDelete
      : false;

    const pipelineWithSoftDelete = [...pipelines];

    const hasDeletedMatch = pipelineWithSoftDelete.some(
      (stage) =>
        stage.$match &&
        (Object.prototype.hasOwnProperty.call(stage.$match, "deleted") ||
          Object.prototype.hasOwnProperty.call(stage.$match, "deletedAt")),
    );
    if (!skipDeleted && !hasDeletedMatch) {
      pipelineWithSoftDelete.unshift({
        $match: {
          $and: [
            { $or: [{ deleted: { $exists: false } }, { deleted: false }] },
            { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
          ],
        },
      });
    }

    // If filter is provided, add it to the pipeline
    if (Object.keys(filter).length > 0) {
      pipelineWithSoftDelete.unshift({ $match: filter });
    }

    // Prepare the total pipeline for counting documents
    const totalPipeline = [...pipelineWithSoftDelete];

    // Add pagination stages to the pipeline
    pipelineWithSoftDelete.push({ $skip: skip }, { $limit: limitNumber + 1 });

    // Add sorting stage if provided
    if (Object.keys(sort).length > 0) {
      pipelineWithSoftDelete.push({ $sort: sort });
    }

    // Execute the total count and the paginated results in parallel
    const [totalResult, results] = await Promise.all([
      this.aggregate(totalPipeline).exec(),
      this.aggregate(pipelineWithSoftDelete).exec(),
    ]);

    // Determine pagination details
    const total = totalResult.length > 0 ? totalResult[0].count : 0; // Assuming total count is in the first document
    const hasNextPage = results.length > limitNumber;
    const data = hasNextPage ? results.slice(0, limitNumber) : results;
    const hasPreviousPage = pageNumber > 0;
    const nextPage = hasNextPage ? pageNumber + 1 : null;
    const previousPage = hasPreviousPage ? pageNumber - 1 : null;

    // Return the paginated result
    return {
      data,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        hasNextPage,
        hasPreviousPage,
        nextPage,
        previousPage,
      },
    };
  }

  // Exclude soft-deleted docs from find queries by default,
  // unless skipSoftDelete is set in query options
  function softDeleteFilter(this: any, next: Function) {
    // If skipSoftDelete option is true, do not filter out deleted docs
    if (this.getOptions && this.getOptions().skipSoftDelete) {
      return next();
    }

    const filter = this.getFilter ? this.getFilter() : {};

    // Only add filter if neither 'deleted' nor 'deletedAt' is already present in the query
    const hasDeleted = Object.prototype.hasOwnProperty.call(filter, "deleted");
    const hasDeletedAt = Object.prototype.hasOwnProperty.call(
      filter,
      "deletedAt",
    );

    if (!hasDeleted && !hasDeletedAt) {
      this.where({
        $and: [
          { $or: [{ deleted: { $exists: false } }, { deleted: false }] },
          { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
        ],
      });
    }
    next();
  }

  // Exclude soft-deleted docs from aggregate queries by default,
  // unless skipSoftDelete is set in aggregate options
  function softDeleteFilterAggregate(this: any, next: Function) {
    if (this.options && this.options.skipSoftDelete) {
      return next();
    }

    // Check if a $match for deleted or deletedAt already exists
    const pipeline = this.pipeline();
    const hasDeletedMatch = pipeline.some(
      (stage) =>
        stage.$match &&
        (Object.prototype.hasOwnProperty.call(stage.$match, "deleted") ||
          Object.prototype.hasOwnProperty.call(stage.$match, "deletedAt")),
    );

    if (!hasDeletedMatch) {
      this.pipeline().unshift({
        $match: {
          $and: [
            { $or: [{ deleted: { $exists: false } }, { deleted: false }] },
            { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
          ],
        },
      });
    }
    next();
  }

  // Helper to check if filter or any $and clause already has deleted/deletedAt
  function hasSoftDeleteCondition(obj: any): boolean {
    if (!obj || typeof obj !== "object") return false;
    if ("deleted" in obj || "deletedAt" in obj) return true;
    if (Array.isArray(obj.$and)) {
      return obj.$and.some((sub: any) => hasSoftDeleteCondition(sub));
    }
    return false;
  }

  async function paginateFind(
    this: any,
    request: IPaginationRequest,
    filter: any = {},
    options: any = {},
  ) {
    const { page = 0, limit = 5, sort = {} } = request;

    // Ensure page and limit are numbers
    const pageNumber = Math.max(0, parseInt(page.toString(), 10));
    const limitNumber = Math.max(1, parseInt(limit.toString(), 10));
    const skip = pageNumber * limitNumber;

    const skipDeleted = this.getOptions
      ? this.getOptions().skipSoftDelete
      : false;

    // If skipDeleted is false, ensure soft delete conditions are applied
    if (!skipDeleted && !hasSoftDeleteCondition(filter)) {
      // Only add soft delete filter if not already applied
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [{ deleted: { $exists: false } }, { deleted: false }],
      });
      filter.$and.push({
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      });
    }

    const populate = options.populate || null;
    const projection = options.projection || null;
    if (projection) {
      delete options.projection; // Remove projection from options to avoid conflicts
    }
    const query = this.find(filter, projection, options)
      .skip(skip)
      .limit(limitNumber + 1) // Fetch one extra to check for next page
      .sort(sort);
    // If populate is provided, apply it to the query
    if (populate) {
      delete options.populate; // Remove populate from options to avoid conflicts
      query.populate(populate);
    }

    // Count total documents and get results matching the filter
    const [total, results] = await Promise.all([
      this.countDocuments(filter).exec(),
      query.exec(),
    ]);

    // Determine pagination details
    // If results exceed limit, we have a next page
    const hasNextPage = results.length > limitNumber;

    // If we have a next page, slice the results to return only the requested limit
    // Otherwise, return all results
    const paginatedResults = hasNextPage
      ? results.slice(0, limitNumber)
      : results;

    // has previous page is true if pageNumber is greater than 1
    const hasPreviousPage = pageNumber > 0;

    // nextPage and previousPage are set based on the current page and pagination state
    const nextPage = hasNextPage ? pageNumber + 1 : null;
    const previousPage = hasPreviousPage ? pageNumber - 1 : null;

    // Return the paginated result
    return {
      data: paginatedResults,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        hasNextPage,
        hasPreviousPage,
        nextPage,
        previousPage,
      },
    };
  }

  /**
   * Lookup with search functionality
   * @param options - Options for the lookup and search
   * @returns Paginated results with lookup and search applied
   */
  async function lookupWithSearch(this: any, options: LookupWithSearchOptions) {
    const {
      page = 0,
      limit = 5,
      baseMatch = {},
      searchText = "",
      searchKeys = {},
      sort = { _id: -1 },
      lookup,
      lookups,
      project,
      set,
      unset,
      skipSoftDelete = false, // New option to skip soft delete filtering
    } = options;

    // Ensure page and limit are numbers
    const pageNumber = Math.max(0, parseInt(page.toString(), 10));
    const limitNumber = Math.max(1, parseInt(limit.toString(), 10));
    const skip = pageNumber * limitNumber;

    const pipelines: PipelineStage[] = [];

    // 🔒 Soft delete filtering
    if (!skipSoftDelete) {
      pipelines.push({
        $match: {
          $and: [
            { $or: [{ deleted: { $exists: false } }, { deleted: false }] },
            { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
          ],
        },
      });
    }

    pipelines.push({ $match: baseMatch });

    // add lookup stages
    addLookups(pipelines, lookups, lookup);

    // TODO: Kishor - Check for the optimization
    pipelines.push({ $sort: sort });

    // search
    const searchConditions: Record<string, any>[] = [];

    if (
      searchText &&
      typeof searchText === "string" &&
      searchText.trim() !== "" &&
      searchKeys &&
      Array.isArray(searchKeys) &&
      searchKeys.length > 0
    ) {
      const decodedText = decodeURIComponent(searchText);
      const escapedText = escapeRegex(decodedText.trim()); // Always escape for all fields

      for (const key of searchKeys) {
        if (typeof key === "string" && key.trim()) {
          searchConditions.push({
            [key]: { $regex: escapedText, $options: "i" },
          });
        }
      }
    }

    /// If search conditions are provided, add them to the pipeline
    if (searchConditions.length > 0) {
      pipelines.push({
        $match: {
          $or: searchConditions,
        },
      });
    }

    // add skip and limit for pagination
    pipelines.push({ $skip: skip });
    pipelines.push({ $limit: limit + 1 }); // Fetch one extra to check for next page

    // Add $project stage if provided
    if (project) {
      pipelines.push({ $project: project });
    }

    // Add $set stage if provided
    if (set) {
      pipelines.push({ $set: set });
    }

    // Add $unset stage if provided
    if (unset) {
      pipelines.push({ $unset: unset });
    }

    const countPipelines: PipelineStage[] = pipelines.filter(
      (stage) =>
        !Object.prototype.hasOwnProperty.call(stage, "$skip") &&
        !Object.prototype.hasOwnProperty.call(stage, "$limit") &&
        !Object.prototype.hasOwnProperty.call(stage, "$project") &&
        !Object.prototype.hasOwnProperty.call(stage, "$set") &&
        !Object.prototype.hasOwnProperty.call(stage, "$unset"),
    );
    countPipelines.push({ $count: "count" });

    // Execute the total count and the paginated results in parallel
    const [totalResult, results] = await Promise.all([
      this.aggregate(countPipelines).exec(),
      this.aggregate(pipelines).exec(),
    ]);

    // Determine pagination details
    const total = totalResult.length > 0 ? totalResult[0].count : 0; // Assuming total count is in the first document
    const hasNextPage = results.length > limitNumber;
    const data = hasNextPage ? results.slice(0, limitNumber) : results;
    const hasPreviousPage = pageNumber > 0;
    const nextPage = hasNextPage ? pageNumber + 1 : null;
    const previousPage = hasPreviousPage ? pageNumber - 1 : null;

    // Return the paginated result
    return {
      data,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        hasNextPage,
        hasPreviousPage,
        nextPage,
        previousPage,
      },
    };
  }
  // Typed helper to add single/multiple $lookup and $unwind stages
  function addLookups(
    pipelines: PipelineStage[],
    lookups?: LookupStage[],
    lookup?: LookupStage,
  ): void {
    const allLookups: LookupStage[] = [];
    if (lookup) allLookups.push(lookup); // deprecated single lookup
    if (Array.isArray(lookups)) allLookups.push(...lookups);

    if (allLookups.length === 0) return;

    for (const lk of allLookups) {
      pipelines.push({
        $lookup: {
          from: lk.from,
          localField: lk.localField,
          foreignField: lk.foreignField,
          as: lk.as,
        },
      });

      pipelines.push({
        $unwind: {
          path: `$${lk.as}`,
          preserveNullAndEmptyArrays: true, // Keep documents without matching lookup
        },
      });
    }
  }

  // Apply the soft delete filter to various query methods
  schema.pre("find", softDeleteFilter);
  schema.pre("findOne", softDeleteFilter);
  schema.pre("countDocuments", softDeleteFilter);
  schema.pre("findOneAndUpdate", softDeleteFilter);
  schema.pre("updateMany", softDeleteFilter);
  schema.pre("aggregate", softDeleteFilterAggregate);
}
