import { Injectable } from "@nestjs/common";
import { HttpStatus } from "@nestjs/common";
import { Model, Types } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { ErrorException } from "@libs/common/exceptions";
import {
  RidesRepository,
  User,
  RidesDocument,
  Rides,
  AppliedToEnum,
  PromoCodeStatusEnum,
  DiscountTypeEnum,
  PromoCode,
  PromoCodeDocument,
  RideStatus,
  RideTypes,
  CreatePromoCodeInput,
} from "@libs/data-access";
import { PromoCodeUsed, PromoCodeUsedDocument } from "@libs/data-access/entities/promo-code-used.entity";
import { toMongoId } from "@libs/common";
import { transformToEntityNameObjectFromId } from "@libs/common/utils/entity.utils";

/**
 * Promo-code application logic for rides.
 */
@Injectable()
export class RidePromoService {
  constructor(
    private readonly rideRepository: RidesRepository,
    @InjectModel(PromoCode.name)
    private readonly promoCodeModel: Model<PromoCodeDocument>,
    @InjectModel(PromoCodeUsed.name)
    private readonly promoCodeUsedModel: Model<PromoCodeUsedDocument>,
  ) {}

  /**
   * Creates a new promo code in the database.
   * @param input Data for the new promo code.
   * @returns The created PromoCode document.
   */
  async createPromoCode(
    input: CreatePromoCodeInput,
  ): Promise<PromoCodeDocument> {
    return this.promoCodeModel.create(input);
  }

  async applyPromoCode(
    user: User,
    rideId: string,
    promoCodeId: string,
  ): Promise<any> {
    const ride = await this.rideRepository.findById(toMongoId(rideId));
    if (!ride || ride.passengerId.toString() !== user._id.toString()) {
      ErrorException(null, "RIDES.RIDE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    if (ride.fare && ride.fare["promoCodeId"]) {
      ErrorException(
        null,
        "RIDES.PROMO_ALREADY_APPLIED",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!ride.rideEndedAt) {
      ErrorException(
        null,
        "RIDES.PROMO_NOT_APPLICABLE_FOR_STATUS",
        HttpStatus.BAD_REQUEST,
      );
    }

    const promo = await this.promoCodeModel
      .findById(toMongoId(promoCodeId))
      .exec();

    if (!promo) {
      ErrorException(null, "RIDES.PROMO_CODE_NOT_FOUND", HttpStatus.BAD_REQUEST);
    }

    // DiscountType & validation checks
    const discountType = promo.discountType; // "PERCENTAGE" | "FLAT"
    const appliedTo = promo.appliedTo; // "ALL_RIDES" | "INSTANT" | "SCHEDULED"

    if (appliedTo !== (ride.rideType as unknown as AppliedToEnum) && appliedTo !== AppliedToEnum.ALL_RIDES) {
      ErrorException(
        null,
        "RIDES.PROMO_NOT_APPLICABLE_FOR_RIDE_TYPE",
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = new Date();
    if (promo.status === PromoCodeStatusEnum.EXPIRED || promo.expiryDateTime < now) {
      ErrorException(null, "RIDES.PROMO_EXPIRED", HttpStatus.BAD_REQUEST);
    }
    if (promo.startDateTime > now) {
      ErrorException(null, "RIDES.PROMO_NOT_STARTED", HttpStatus.BAD_REQUEST);
    }
    if (promo.status !== PromoCodeStatusEnum.ACTIVE) {
      ErrorException(null, "RIDES.PROMO_INACTIVE", HttpStatus.BAD_REQUEST);
    }

    const totalUsage = await this.promoCodeUsedModel.countDocuments({
      promoCodeId: promo._id,
    });
    if (totalUsage >= promo.totalUsageLimit) {
      ErrorException(null, "RIDES.PROMO_TOTAL_LIMIT_REACHED", HttpStatus.BAD_REQUEST);
    }

    const usageCount = await this.promoCodeUsedModel.countDocuments({
      userId: user._id,
      promoCodeId: promo._id,
    });
    if (usageCount >= promo.perUserLimit) {
      ErrorException(null, "RIDES.PROMO_LIMIT_REACHED", HttpStatus.BAD_REQUEST);
    }

    if (Number(ride.estimatedFare) < (Number(promo.minimumFare) || 0)) {
      ErrorException(null, "RIDES.MIN_FARE_NOT_MET", HttpStatus.BAD_REQUEST);
    }

    let discount = 0;
    if (discountType === DiscountTypeEnum.PERCENTAGE) {
      discount = Math.round(
        Number(ride.estimatedFare) * ((Number(promo.percentageAmount) || 0) / 100),
      );
      if (promo.maxDiscount && discount > Number(promo.maxDiscount)) {
        discount = Math.round(Number(promo.maxDiscount));
      }
    } else {
      discount = Math.round(Number(promo.flatAmount) || 0);
      if (discount > Number(ride.fare?.totalAmount || ride.estimatedFare)) {
        discount = Math.round(Number(ride.fare?.totalAmount || ride.estimatedFare));
      }
    }

    const subTotal = Math.round(Number(ride.estimatedFare));
    const finalAmount = Math.max(0, subTotal - discount);

    const updatedRide = await this.rideRepository.findOneAndUpdate(
      { _id: ride._id },
      {
        $set: {
          estimatedFare: finalAmount,
          "fare.discountAmount": discount,
          "fare.promoCodeId": promo._id,
          "fare.promoCodeName": promo.name,
          "fare.subTotal": subTotal,
          "fare.totalAmount": finalAmount,
          "paymentDetails.promoCodeId": promo._id,
          "paymentDetails.promoCodeName": promo.name,
          "paymentDetails.discountAmount": discount,
          "paymentDetails.subTotal": subTotal,
          "paymentDetails.totalAmount": finalAmount,
        },
      },
      { new: true },
    );

    await this.promoCodeUsedModel.create({
      userId: user._id,
      promoCodeId: promo._id,
      rideId: ride._id,
    });

    await this.promoCodeModel.updateOne(
      { _id: promo._id },
      { $inc: { promoCodeUsedCount: 1 } },
    );

    const rideObj = updatedRide.toObject() as any;
    transformToEntityNameObjectFromId(rideObj, ["vehicleId", "vehicle"]);

    return {
      message: "RIDES.PROMO_APPLIED",
      success: true,
      ride: rideObj,
    };
  }

  async removePromoCode(user: User, rideId: string): Promise<any> {
    const ride = await this.rideRepository.findById(toMongoId(rideId));
    if (!ride || ride.passengerId.toString() !== user._id.toString()) {
      ErrorException(null, "RIDES.RIDE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    if (!ride.fare || !ride.fare["promoCodeId"]) {
      return { success: true, message: "RIDES.PROMO_REMOVED", ride };
    }

    const discountAmount = ride.fare["discountAmount"] || 0;
    const promoId = ride.fare["promoCodeId"];

    const revertedFare = Math.round(
      Number(ride.estimatedFare) + Number(discountAmount),
    );
    const updatedRide = await this.rideRepository.findOneAndUpdate(
      { _id: ride._id },
      {
        $set: {
          estimatedFare: revertedFare,
          "fare.discountAmount": 0,
          "fare.promoCodeId": null,
          "fare.promoCodeName": null,
          "fare.subTotal": ride.fare.totalAmount,
          "paymentDetails.promoCodeId": null,
          "paymentDetails.promoCodeName": null,
          "paymentDetails.discountAmount": 0,
          "paymentDetails.subTotal": ride.fare.totalAmount,
        },
      },
      { new: true },
    );

    await this.promoCodeUsedModel.deleteOne({
      rideId: ride._id,
      promoCodeId: promoId,
      userId: user._id,
    });
    await this.promoCodeModel.updateOne(
      { _id: promoId },
      { $inc: { promoCodeUsedCount: -1 } },
    );

    const rideObj = updatedRide.toObject() as any;
    transformToEntityNameObjectFromId(rideObj, ["vehicleId", "vehicle"]);

    return {
      message: "RIDES.PROMO_REMOVED",
      success: true,
      ride: rideObj,
    };
  }
}