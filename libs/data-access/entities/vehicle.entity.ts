import { Field, Int, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { BaseEntity } from "@libs/data-access/base/base.entity";
import { VehicleImage, VehicleImageSchema } from "./vehicle-image.embedded";

export type VehicleDocument = HydratedDocument<Vehicle>;

@ObjectType()
@Schema({ timestamps: true })
export class Vehicle extends BaseEntity {
  @Field(() => String)
  @Prop({ type: Types.ObjectId, required: true, ref: "User", index: true })
  driverId: Types.ObjectId;


  @Field(() => String)
  @Prop({ type: String, required: true, enum: ["CAR", "MOTORBIKE", "SCOOTER"] })
  vehicleType: string;

  @Field()
  @Prop({ type: String, required: true })
  vehicleModel: string;

  @Field(() => Int)
  @Prop({ type: Number, required: true })
  year: number;

  @Field()
  @Prop({ type: String, required: true })
  color: string;

  @Field()
  @Prop({ type: String, required: true, unique: true })
  numberPlate: string;

  // All vehicle images embedded — ACTIVE = current, INACTIVE = pending midnight deletion
  @Field(() => [VehicleImage])
  @Prop({ type: [VehicleImageSchema], default: [] })
  images: VehicleImage[];
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);