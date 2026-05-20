import { Injectable } from "@nestjs/common";
import { BaseRepository } from "../base/base.repository";
import { InjectModel } from "@nestjs/mongoose";
import { Rides, RidesDocument } from "../entities/rides.entity";
import { BaseModel } from "../base/base.model";
import { User } from "../entities/user.entity";
import { PaginationInput } from "../base/base.input";
import { IPaginatedResult } from "../interfaces/pagination.interface";
import { roles } from "../enums/user.enum";
import { Types } from "mongoose";

@Injectable()
export class RidesRepository extends BaseRepository<RidesDocument> {
  constructor(@InjectModel(Rides.name) private readonly _model: BaseModel<RidesDocument>) {
    super(_model);
  }

  /**
   * Atomic query to fetch rides based on user role with pagination
   * - USER role: fetches rides where user is the rider (riderId)
   * - DRIVER role: fetches rides where user is the driver (driverId)
   * - Filters by ONGOING status
   * - Returns paginated results
   */
  async findRidesByUserWithPagination(
    user: Partial<User>,
    paginationInput: PaginationInput,
  ): Promise<IPaginatedResult<RidesDocument>> {
    // Build filter based on user role
    const filter: any = {
     ...paginationInput.filter,
      deleted: false, // Exclude soft-deleted rides
    };

    // Check user roles and apply appropriate filter
    if (user.loginAs === roles.USER) {
      // If user has USER role, fetch rides where user is the rider
      filter.riderId = new Types.ObjectId(user._id);
    } else if (user.loginAs === roles.RIDER) {
      // If user has RIDER role, fetch rides where user is the driver
      filter.driverId = new Types.ObjectId(user._id);
    }

    // Apply pagination with the constructed filter
    return this.paginate(paginationInput, undefined, filter);
  }
}