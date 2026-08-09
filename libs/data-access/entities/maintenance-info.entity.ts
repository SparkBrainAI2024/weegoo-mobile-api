import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BaseEntity } from "../base/base.entity";

@ObjectType()
@Schema({ timestamps: true })
export class MaintenanceInfo extends BaseEntity {
  @Field(() => String)
  @Prop({ required: true, type: String, trim: true })
  message: string;
}

export type MaintenanceInfoDocument = HydratedDocument<MaintenanceInfo>;

export const MaintenanceInfoSchema =
  SchemaFactory.createForClass(MaintenanceInfo);

export const maintenanceInfoModel = {
  name: MaintenanceInfo.name,
  schema: MaintenanceInfoSchema,
};