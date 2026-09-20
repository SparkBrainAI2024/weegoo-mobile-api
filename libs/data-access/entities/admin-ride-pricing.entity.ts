import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BaseEntity } from "../base/base.entity";
import { AnyVehicleType, VehicleType } from "../enums/vehicle.enum";

@ObjectType()
@Schema({ timestamps: true })
export class AdminRidePricing extends BaseEntity {
  @Field(() => AnyVehicleType)
  @Prop({
    required: true,
    type: String,
    enum: AnyVehicleType,
    unique: true,
    index: true,
  })
  vehicleType: AnyVehicleType;

  @Field(() => Number)
  @Prop({ required: true, type: Number, min: 0 })
  commission: number;

  @Field(() => Number)
  @Prop({ required: true, type: Number, min: 0 })
  baseFare: number;

  @Field(() => Number)
  @Prop({ required: true, type: Number, min: 0 })
  amountPerKm: number;

  @Field(() => Number)
  @Prop({ required: true, type: Number, min: 0 })
  amountPerMinute: number;

  @Field(() => Boolean)
  @Prop({ required: true, type: Boolean, default: true })
  isEnabled: boolean;
}

export type AdminRidePricingDocument = HydratedDocument<AdminRidePricing>;

export const AdminRidePricingSchema =
  SchemaFactory.createForClass(AdminRidePricing);

export const adminRidePricingModel = {
  name: AdminRidePricing.name,
  schema: AdminRidePricingSchema,
};

AdminRidePricingSchema.index({ vehicleType: 1, deleted: 1, deletedAt: 1 });
