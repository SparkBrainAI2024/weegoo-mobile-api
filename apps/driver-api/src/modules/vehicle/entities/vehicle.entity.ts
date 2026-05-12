import { Field, Int, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { BaseEntity } from "@libs/data-access/base/base.entity";
import { VehicleType } from "@libs/data-access";

export type VehicleDocument = HydratedDocument<Vehicle>;

@ObjectType()
@Schema({ timestamps: true })
export class Vehicle extends BaseEntity {
  @Field(() => String)
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: "User" })
  driverId: Types.ObjectId;

  @Field(() => String)
  @Prop({ type: String, required: true, trim: true })
  imageUrl: string;

  @Field(() => VehicleType)
  @Prop({ type: String, enum: VehicleType, required: true, index: true })
  vehicleType: VehicleType;

  @Field(() => String)
  @Prop({ type: String, required: true, trim: true })
  vehicleModel: string;

  @Field(() => Int)
  @Prop({ type: Number, required: true, min: 1900 })
  year: number;

  @Field(() => String)
  @Prop({ type: String, required: true, trim: true, unique: true, index: true })
  numberPlate: string;

  @Field(() => String)
  @Prop({ type: String, required: true, trim: true })
  color: string;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);

VehicleSchema.index({ driverId: 1, vehicleType: 1 });
VehicleSchema.index({ numberPlate: 1 }, { unique: true });