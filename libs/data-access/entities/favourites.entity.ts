import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { HydratedDocument, Types } from "mongoose";
import { RideLocation } from "../common/ride.location";
import { VehicleType } from "../enums/vehicle.enum";
import { RideTypes } from "../enums/rides.enum";
import { paginateAndSoftDelete } from "../plugins/mongoose.plugin";
@ObjectType()
@Schema({ timestamps: true })
export class Favourites extends BaseEntity {

    @Field(() => RideTypes)
    @Prop({ type: String, enum: RideTypes, required: true })
    rideType: RideTypes;

    @Field(() => String)
    @Prop({ type: Types.ObjectId, required: true, ref: "User", index: true })
    passengerId: Types.ObjectId;

    @Field(() => String)
    @Prop({ type: Types.ObjectId, required: true, ref: "Rides", index: true })
    rideId: Types.ObjectId;

    @Field(() => RideLocation, { nullable: true })
    @Prop({ type: RideLocation, required: false })
    pickupLocation: RideLocation;

    @Field(() => RideLocation, { nullable: true })
    @Prop({ type: RideLocation, required: false })
    dropoffLocation: RideLocation;

    @Field(() => VehicleType)
    @Prop({ type: String, enum: VehicleType, required: true })
    vehicleType: VehicleType;

    @Field(() => Number, { defaultValue: 1 })
    @Prop({ type: Number, default: 1, required: true })
    noOfPassengers?: Number;

    @Field(() => Number, { defaultValue: 0 })
    @Prop({ type: Number, default: 0, required: true })
    estimatedFare?: Number;
}
export type FavouritesDocument = HydratedDocument<Favourites>;
export const FavouritesSchema = SchemaFactory.createForClass(Favourites);


export const favouritesModel = {
    name: Favourites.name,
    schema: FavouritesSchema,
};

FavouritesSchema.plugin(paginateAndSoftDelete);