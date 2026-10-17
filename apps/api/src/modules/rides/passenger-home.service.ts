import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDetails, UserDetailsDocument } from '@libs/data-access/entities/user-details.entity';
import { PromoCode, PromoCodeDocument } from '@libs/data-access/entities/promo-code.entity';
import { PromoCodeStatusEnum } from '@libs/data-access/enums/promo-code.enum';
import { AdminRidePricingService } from '@libs/services/admin-ride-pricing/admin-ride-pricing.service';
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
    private readonly adminRidePricingService: AdminRidePricingService,
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
    const vehicleEstimates = await this.getBasicVehicleEstimates();

    return {
      homeLocation,
      workLocation,
      promoCode,
      vehicleEstimates,
    };
  }

  private async getMostRecentActivePromoCode(): Promise<PassengerPromoCodeResponse | null> {
    try {
      // Get current time in Kathmandu timezone (Asia/Katmandu, UTC+5:45)
      const now = new Date();
      const kathmanduTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Katmandu' });
      const nowInKathmandu = new Date(kathmanduTimeString);
      
      console.log(`Fetching most recent active promo code at ${now.toISOString()} (Kathmandu time: ${nowInKathmandu.toISOString()})`);
      
      const promo = await this.promoCodeModel
        .findOne({
            status: PromoCodeStatusEnum.ACTIVE,
            expiryDateTime: { $gt: nowInKathmandu },
            startDateTime: { $lte: nowInKathmandu },
            deleted: { $ne: true },
        })
        .sort({ startDateTime: -1, _id: -1 })
        .exec();

      if (!promo) return null;

      return {
        promocodeId: promo._id.toString(),
        name: promo.name,
        promocodeUserLimit: promo.perUserLimit,
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

  /**
   * Basic vehicle estimates for the passenger home screen (base fare for 1km).
   *
   * The vehicle list comes ONLY from the admin pricings: a vehicle is shown
   * when its admin pricing row exists, is enabled (isEnabled = true) and is not
   * deleted. Scheduled-only types (JEEP, MICRO) are excluded.
   * Fare = admin baseFare + amountPerKm x 1km (no duration is available here).
   */
  private async getBasicVehicleEstimates(): Promise<BasicVehicleEstimateResponse[]> {
    try {
      const activePricings = await this.adminRidePricingService.findActivePricings();

      // On-demand vehicles only, with their home-screen presentation copy.
      const presentationByType: Record<string, { comfortType: string; hasAC: boolean }> = {
        CAR: { comfortType: 'Standard', hasAC: true },
        MOTORBIKE: { comfortType: 'Economy', hasAC: false },
        SCOOTER: { comfortType: 'Economy', hasAC: false },
        JEEP: { comfortType: 'Comfort', hasAC: true },
        MICRO: { comfortType: 'Comfort', hasAC: true },
      };

      return activePricings
        .filter((pricing) => Boolean(presentationByType[pricing.vehicleType as string]))
        .map((pricing) => {
          const type = pricing.vehicleType as string;
          const baseFare = Number(pricing.baseFare) || 0;
          const perKmRate = Number(pricing.amountPerKm) || 0;
          // Base estimated fare for 1km = admin baseFare + 1km rate
          const estimatedFare = baseFare + perKmRate * 1;
          const { comfortType, hasAC } = presentationByType[type];

          return {
            vehicleType: type,
            estimatedFare: Math.round(estimatedFare * 100) / 100,
            comfortType,
            hasAC,
          };
        });
    } catch (error: any) {
      this.logger.error(`Failed to load admin ride pricings for basic estimates: ${error?.message}`);
      return [];
    }
  }
}