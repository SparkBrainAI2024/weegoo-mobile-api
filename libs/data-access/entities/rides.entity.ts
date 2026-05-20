import { Field, ObjectType, GraphQLISODateTime } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { HydratedDocument, Types } from "mongoose";
import { RideStatus, RideTypes } from "../enums/rides.enum";
import { Cancellation } from "../common/cancellation";
import { RideLocation } from "../common/ride.location";
import { Fare } from "../common/fare";
import { PaymentDetails } from "../common/payment-details";
import { Vehicle } from "./vehicle.entity";
import {customAlphabet} from 'nanoid'
const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 16);
@ObjectType()
@Schema({ timestamps: true })
export class Rides extends BaseEntity {

    @Field(() => RideTypes)
    @Prop({ type: String, enum: RideTypes, required: true })
    rideType: RideTypes;

    @Field(() => Date)
    @Prop({ type: Date, required: true })
    bookingTime: Date;

    @Field(() => RideStatus)
    @Prop({ type: String, enum: RideStatus, required: true })
    rideStatus: RideStatus;

    @Field(() => Cancellation, { nullable: true })
    @Prop({ type: Cancellation, required: false })
    cancellation: Cancellation;

    @Field(() => String)
    @Prop({ type: Types.ObjectId, required: true, ref: "User", index: true })
    riderId: Types.ObjectId;

    @Field(() => String)
    @Prop({ type: Types.ObjectId, required: true, ref: "User", index: true })
    driverId: Types.ObjectId;

    @Field(() => RideLocation, { nullable: true })
    @Prop({ type: RideLocation, required: false })
    pickupLocation: RideLocation;

    @Field(() => RideLocation, { nullable: true })
    @Prop({ type: RideLocation, required: false })
    dropoffLocation: RideLocation;

    @Field(() => String, { nullable: true })
    @Prop({ 
        type: String, 
        required: true, 
        unique: true, 
        default: () => "RIDE-" + nanoid() 
    })
    rideUUId: string;

    @Field(() => Number, { nullable: true })
    @Prop({ type: Number, required: false, default: 0 })
    estimatedTimeInMinutes?: number;

    @Field(() => Number, { nullable: true })
    @Prop({ type: Number, required: false, default: 0 })
    estimatedFare?: number;

    @Field(() => Date, { nullable: true })
    @Prop({ type: Date, required: false })
    rideStartedAt?: Date;

    @Field(() => Date, { nullable: true })
    @Prop({ type: Date, required: false })
    rideCompletedAt?: Date;

    @Field(() => Number, { nullable: true })
    @Prop({ type: Number, required: false, default: 0 })
    distanceInKm?: number;

    @Field(() => Fare, { nullable: true })
    @Prop({ type: Fare, required: false })
    fare?: Fare

    @Field(() => PaymentDetails, { nullable: true })
    @Prop({ type: PaymentDetails, required: false })
    paymentDetails?: PaymentDetails;

    @Field(() => Number, { nullable: true })
    @Prop({ type: Number, required: false, default: 0 })
    timeToReachRiderInMinutes?: number;

    @Field(() => Date, { nullable: true })
    @Prop({ type: Date, required: false })
    timeToReachRider?: Date;

    @Field(() => String)
    @Prop({ type: Types.ObjectId, required: true, ref: Vehicle.name, index: true })
    vehicleId: Types.ObjectId;

    @Field(() => Vehicle, { nullable: true })
    vehicle?: Vehicle;
}
export type RidesDocument = HydratedDocument<Rides>;
export const RidesSchema = SchemaFactory.createForClass(Rides);

RidesSchema.pre<RidesDocument>("save", function (next) {
  // 2. Calculate timeToReachRider (based on distance and bookingTime)
  if (this.distanceInKm && this.bookingTime) {
    // Assume avg speed of 30km/h => 2 minutes per km
    this.timeToReachRiderInMinutes = Math.ceil(this.distanceInKm * 2);
    this.timeToReachRider = new Date(
      this.bookingTime.getTime() + this.timeToReachRiderInMinutes * 60000
    );
  }

  // 3. Calculate Estimated Fare and Time when ride starts or is ongoing
  const baseFare = 50;
  const perKmRate = 20;
  const perMinuteRate = 5;

  if (this.distanceInKm) {
    this.estimatedTimeInMinutes = Math.ceil(this.distanceInKm * 2);
    this.estimatedFare = baseFare + this.distanceInKm * perKmRate;
  }

  // 4. Recalculate if ride is completed (using actual duration)
  if (this.rideStartedAt && this.rideCompletedAt) {
    const durationMs =
      this.rideCompletedAt.getTime() - this.rideStartedAt.getTime();
    const actualMinutes = Math.ceil(durationMs / 60000);

    this.estimatedTimeInMinutes = actualMinutes;
    this.estimatedFare =
      baseFare +
      (this.distanceInKm || 0) * perKmRate +
      actualMinutes * perMinuteRate;
  }

  next();
});

export const ridesModel = {
    name: Rides.name,
    schema: RidesSchema,
};

RidesSchema.index({ deleted: 1, deletedAt: 1 });