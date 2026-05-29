import { PaginationInput, RidesRepository, User, RidesDocument, RideStatus, RideTypes, ProvinceEnum, roles } from '@libs/data-access';
import { Types } from 'mongoose';
import { BadRequestException, ForbiddenException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { ErrorException } from '@libs/common/exceptions';
import { CancelRideInput } from '@libs/data-access/dtos/input/cancel-ride.input';
import { IssueRepository } from '@libs/data-access/repositories/issue.repository';
import { CategoryAccessedByRole, IssueCategoryForRole, IssueParentCategory } from '@libs/data-access/enums/issue.enum';
import { toMongoId } from '@libs/common';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);
  constructor(
    private readonly rideRepository: RidesRepository,
    private readonly transactionService:TransactionService,
    private readonly issueRepository: IssueRepository
  ) {}

  /**
   * Fetches rides for the current user based on their role with pagination.
   * - If user role is USER: returns rides where user is the rider
   * - If user role is DRIVER: returns rides where user is the driver
   * - Vehicle data (model, name/type) is populated in the result
   * - Returns paginated results
   */
  async findRides(
    user: User,
    options: PaginationInput,
  ) {
    return this.rideRepository.findRidesByUserWithPagination(user, options);
  }
  
  async homeDashboardApi(
    user: User,
  ){
    return this.rideRepository.homeDashboardApi(user);
  }
  /**
   * Creates a new ride with an auto-generated rideUUId using nanoid.
   * Also calculates timeToReachRiderInMinutes and timeToReachRider based on
   * distance and booking time before saving.
   */
  async createRide(rideData: Partial<RidesDocument>): Promise<RidesDocument> {
    return this.rideRepository.createRide(rideData);
  }

  /**
   * Starts a ride by setting rideStartedAt and updating ride status to ONGOING.
   * Calculates estimatedTimeInMinutes and estimatedFare based on distance.
   */
  async startRide(rideId: Types.ObjectId, startedAt: Date, distanceInKm?: number): Promise<RidesDocument | null> {
    return this.rideRepository.startRide(rideId, startedAt, distanceInKm);
  }

  /**
   * Completes a ride by setting rideCompletedAt, rideStatus to COMPLETED.
   * Calculates actual duration from rideStartedAt to rideCompletedAt for
   * estimatedTimeInMinutes and estimatedFare.
   */
  async completeRide(rideId: Types.ObjectId, completedAt: Date, distanceInKm?: number): Promise<RidesDocument | null> {
    return this.rideRepository.completeRide(rideId, completedAt, distanceInKm);
  }

  /**
   * Generates a specified number of sample rides for testing purposes.
   * This method creates 20 instant and 20 scheduled rides with varying statuses.
   * The rideUUId, estimatedFare, estimatedTimeInMinutes, timeToReachRiderInMinutes,
   * and timeToReachRider are automatically calculated by the pre-save hook.
   */
  async generateSampleRides(
    driverId: Types.ObjectId,
    riderId: Types.ObjectId,
    vehicleId: Types.ObjectId,
    adminId: Types.ObjectId,
    countPerType: number = 20, // 20 instant, 20 scheduled
  ): Promise<RidesDocument[]> {
    const generatedRides: RidesDocument[] = [];
    const rideTypes = [RideTypes.INSTANT, RideTypes.SCHEDULED];

    for (const rideType of rideTypes) {
      for (let i = 0; i < countPerType; i++) {
        let rideStatus: RideStatus;
        let rideStartedAt: Date | undefined;
        let rideCompletedAt: Date | undefined;

        // Distribute statuses as requested: 10 confirmed, 3 ongoing, 2 completed, 2 canceled, 3 more confirmed
        if (i < 10) {
          rideStatus = RideStatus.CONFIRMED;
        } else if (i < 13) {
          rideStatus = RideStatus.ONGOING;
        } else if (i < 15) {
          rideStatus = RideStatus.COMPLETED;
        } else if (i < 17) {
          rideStatus = RideStatus.CANCELLED;
        } else {
          rideStatus = RideStatus.PENDING; // Remaining 3 rides
        }

        const bookingTime = new Date(Date.now() - Math.random() * 3600000 * 24); // Random booking time within last 24 hours
        const distanceInKm = parseFloat((Math.random() * 15 + 2).toFixed(1)); // Random distance between 2.0 and 17.0 km

        if (rideStatus === RideStatus.ONGOING || rideStatus === RideStatus.COMPLETED) {
          rideStartedAt = new Date(bookingTime.getTime() + Math.random() * 10 * 60000); // Started 0-10 mins after booking
        }
        if (rideStatus === RideStatus.COMPLETED && rideStartedAt) {
          // Assuming average speed of 30km/h, so 2 minutes per km. Add some randomness.
          const travelTimeMs = distanceInKm * 2 * 60000 + Math.random() * 5 * 60000;
          rideCompletedAt = new Date(rideStartedAt.getTime() + travelTimeMs);
        }

        const rideData: Partial<RidesDocument> = {
          rideType: rideType,
          bookingTime: bookingTime,
          rideStatus: rideStatus,
          passengerId: riderId,
          driverId:  driverId,
          vehicleId: vehicleId,
          distanceInKm: distanceInKm,
          rideStartedAt: rideStartedAt,
          rideCompletedAt: rideCompletedAt,
          pickupLocation: {
            address: `Kathmandu ward -${i + 1}`,
            city: 'Kathmandu',
            province: ProvinceEnum.BAGMATI,
            district: 'Kathmandu',
            fullAddress: `Kathmandu ward -${i + 1}`,
            type: 'Point',
            coordinates: [85.3 + Math.random() * 0.1, 27.7 + Math.random() * 0.1],
          } as any,
          dropoffLocation: {
            address: `Kathmandu ward ${i + 2}}`,
            city: 'Kathmandu',
            province: ProvinceEnum.BAGMATI,
            district: 'Kathmandu',
            fullAddress: `  Kathmandu ward ${i + 2}`,
            type: 'Point',
            coordinates: [85.4 + Math.random() * 0.1, 27.8 + Math.random() * 0.1],
          } as any,
          deleted: false,
        };
        const newRide = await this.rideRepository.createRide(rideData);
        // NOW we have newRide._id

        if (newRide.rideStatus === RideStatus.CONFIRMED && process.env.NODE_ENV !== "local") {
          await this.transactionService.createRideTransactions({
            tripId: newRide._id.toString(),
            adminId: adminId.toString(),
            riderId: newRide.passengerId.toString(),
            driverId: newRide.driverId.toString(),
            totalFare: newRide.estimatedFare,
            commission: newRide.estimatedFare * 0.2, // Assuming 20% commission for testing
          });
        }

        generatedRides.push(newRide);
      }
    }

    return generatedRides;
  }

async cancelRide(user: User, input: CancelRideInput): Promise<RidesDocument> {

  const userLoginAs = user.loginAs===roles.RIDER? "DRIVER" : "PASSENGER";
  this.logger.log(`User ${user._id} with role ${user.loginAs} is attempting to cancel ride ${input.rideId} with subcategory ${input.cancelSubCategoryId} and reason ${input.cancelReasonContent}`);
  const ride = await this.rideRepository.findById(new Types.ObjectId(input.rideId));

  if (!ride) {
    ErrorException(null, 'RIDES.RIDE_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

    const subCategory = await this.issueRepository.findIssueCategoryById(
    input.cancelSubCategoryId
  );
  this.logger.log(`Fetched subcategory ${subCategory?._id} with label ${subCategory?.label} for cancellation, categoryForRole: ${subCategory?.categoryForRole}`);

  if((subCategory.parentCategory).toLowerCase() !== (IssueParentCategory.CANCEL).toLowerCase()){ 
    ErrorException(null, 'RIDES.INVALID_CANCEL_SUB_CATEGORY', HttpStatus.BAD_REQUEST);
  }


if(!(subCategory.categoryForRole === IssueCategoryForRole.BOTH || subCategory.categoryForRole === userLoginAs as IssueCategoryForRole)){
    ErrorException(null, 'RIDES.INVALID_CANCEL_SUB_CATEGORY', HttpStatus.BAD_REQUEST);

}

if ((subCategory.label.toLowerCase()) === 'other' && !input.cancelReasonContent) {
  ErrorException(null, 'RIDES.CANCEL_REASON_REQUIRED_FOR_OTHER', HttpStatus.BAD_REQUEST);
}

  const isPassenger = ride.passengerId.toString() === user._id.toString();
  const isDriver = ride.driverId.toString() === user._id.toString();

if (!isPassenger && !isDriver) {
  ErrorException(null, 'RIDES.CANCEL_UNAUTHORIZED', HttpStatus.FORBIDDEN);
}

if (ride.rideStatus === RideStatus.CANCELLED) {
  ErrorException(null, 'RIDES.CANCEL_ALREADY_CANCELLED', HttpStatus.BAD_REQUEST);
}

if (ride.rideStatus === RideStatus.COMPLETED) {
  ErrorException(null, 'RIDES.CANCEL_ALREADY_COMPLETED', HttpStatus.BAD_REQUEST);
}

if (ride.rideStatus === RideStatus.ONGOING) {
  ErrorException(null, 'RIDES.CANCEL_IN_PROGRESS', HttpStatus.BAD_REQUEST);
}

if (ride.rideStatus === RideStatus.PENDING) {
  ErrorException(null, 'RIDES.CANCEL_PENDING', HttpStatus.BAD_REQUEST);
}

  return this.rideRepository.cancelRide({
    rideId: input.rideId,
    cancelledBy: user._id,
    cancelledByRole: userLoginAs as CategoryAccessedByRole,
    cancelSubCategoryId: toMongoId(input.cancelSubCategoryId), // Convert to ObjectId using
    cancelSubCategoryLabel: input.cancelSubCategoryLabel,
    cancelReasonContent: input.cancelReasonContent,
  });
}
}

