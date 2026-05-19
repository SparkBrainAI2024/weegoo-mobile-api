import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { HydratedDocument, Types } from "mongoose";
import { RideStatus, RideTypes } from "../enums/rides.enum";
import { DateTime } from "node_modules/graphql-scalars/typings/mocks.cjs";
import { Cancellation } from "../common/cancellation";
import { RideLocation } from "../common/ride.location";
import { Fare } from "../common/fare";
import { PaymentDetails } from "../common/payment-details";

@ObjectType()
@Schema({ timestamps: true })
export class Rides extends BaseEntity {

    @Field(() => RideTypes)
    @Prop({ type: String, enum: RideTypes, required: true })
    rideType: RideTypes;

    @Field(() => DateTime)
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
    @Prop({ type: String, required: true, unique: true })
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
    @Prop({ type: Types.ObjectId, required: true, ref: "Vehicle", index: true })
    vehicleId: Types.ObjectId;
}
export type RidesDocument = HydratedDocument<Rides>;
export const RidesSchema = SchemaFactory.createForClass(Rides);

export const ridesModel = {
    name: Rides.name,
    schema: RidesSchema,
};

RidesSchema.index({ deleted: 1, deletedAt: 1 });