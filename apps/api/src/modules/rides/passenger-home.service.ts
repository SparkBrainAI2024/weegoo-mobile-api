import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDetails, UserDetailsDocument } from '@libs/data-access/entities/user-details.entity';
import { PromoCode, PromoCodeDocument } from '@libs/data-access/entities/promo-code.entity';
import { PromoCodeStatusEnum } from '@libs/data-access/enums/promo-code.enum';
import { MATCHMAKING_CONFIG } from '@libs/common';
import {
  PassengerHomeResponse,
  PassengerLocationResponse,
  PassengerPromoCodeResponse,
  BasicVehicleEstimateResponse,
} from '@libs/data-access/dtos/response/passenger-home.response';

@Injectable()
export class PassengerHomeService {
  private readonly logger = new Logger(PassengerHomeService.name);

  constructor(
    @InjectModel(UserDetails.name)
    private readonly userDetailsModel: Model<UserDetailsDocument>,
    @InjectModel(PromoCode.name)
    private readonly promoCodeModel: Model<PromoCodeDocument>,
  ) {}

  async getPassengerHomeData(userId: string): Promise<PassengerHomeResponse> {
    // 1. Fetch user details for home/work locations
    const userDetails = await this.userDetailsModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    // 2. Build home location response
    const homeLocation: PassengerLocationResponse | null =
      userDetails?.homeLocation?.address
        ? {
            address: userDetails.homeLocation.address,
            latitude: userDetails.homeLocation.latitude,
            longitude: userDetails.homeLocation.longitude,
          }
        : null;

    // 3. Build work location response
    const workLocation: PassengerLocationResponse | undefined =
      userDetails?.workLocation?.address
        ? {
            address: userDetails.workLocation.address,
            latitude: userDetails.workLocation.latitude,
            longitude: userDetails.workLocation.longitude,
          }
        : null;

    // 4. Fetch most recent active promo code
    const promoCode = await this.getMostRecentActivePromoCode();

    // 5. Get basic vehicle estimates (base fare for 1km, no pickup/dropoff needed)
    const vehicleEstimates = this.getBasicVehicleEstimates();

    return {
      homeLocation,
      workLocation,
      promoCode,
      vehicleEstimates,
    };
  }

  private async getMostRecentActivePromoCode(): Promise<PassengerPromoCodeResponse | null> {
    try {
      const now = new Date();
      const promo = await this.promoCodeModel
        .findOne({
          status: PromoCodeStatusEnum.ACTIVE,
          expiryDateTime: { $gt: now },
          startDateTime: { $lte: now },
          deleted: false,
        })
        .sort({ createdAt: -1 })
        .exec();

      if (!promo) return null;

      return {
        name: promo.name,
        amount:
          promo.discountType === 'PERCENTAGE'
            ? promo.percentageAmount ?? 0
            : promo.flatAmount ?? 0,
        expiryTime: promo.expiryDateTime,
        offerAvailableTime: promo.startDateTime,
        promocodeType: promo.discountType,
        discountPercentage:
          promo.discountType === 'PERCENTAGE'
            ? promo.percentageAmount ?? undefined
            : undefined,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch active promo code: ${error?.message}`);
      return null;
    }
  }

  private getBasicVehicleEstimates(): BasicVehicleEstimateResponse[] {
    const { FARE } = MATCHMAKING_CONFIG;

    const vehicleTypes = [
      { type: 'CAR', comfortType: 'Standard', hasAC: true },
      { type: 'MOTORBIKE', comfortType: 'Economy', hasAC: false },
      { type: 'SCOOTER', comfortType: 'Economy', hasAC: false },
    ];

    return vehicleTypes.map(({ type, comfortType, hasAC }) => {
      const basePickupCost = FARE.BASE_PICKUP_COST[type] || FARE.BASE_PICKUP_COST['CAR'];
      const perKmRate = FARE.PER_KM_RATE[type] || FARE.PER_KM_RATE['CAR'];
      // Base estimated fare for 1km = pickup cost + 1km rate
      const estimatedFare = basePickupCost + perKmRate * 1;

      return {
        vehicleType: type,
        estimatedFare: Math.round(estimatedFare * 100) / 100,
        comfortType,
        hasAC,
      };
    });
  }
}
