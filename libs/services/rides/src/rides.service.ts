import { Pagination, PaginationInput, RidesRepository, RideStatus, User } from '@libs/data-access';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RidesService {
  constructor(

    private readonly rideRepository: RidesRepository,
  ) {}

  /**
   * Fetches rides for the current user based on their role with pagination.
   * - If user role is USER: returns rides where user is the rider
   * - If user role is DRIVER: returns rides where user is the driver
   * - Filters by ONGOING status
   * - Returns paginated results
   */
  async findRides(
    user: User,
    options: PaginationInput,
  ) {
    return this.rideRepository.findRidesByUserWithPagination(user, options);
  }

  // Additional methods like findUserRides can be added here for the consumer API
}