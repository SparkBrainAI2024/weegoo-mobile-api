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

  /**
   * When true the whole app is under maintenance and every user request
   * (authenticated or not) must be rejected with HTTP 503 + `message`.
   */
  @Field(() => Boolean)
  @Prop({ required: true, type: Boolean, default: false })
  isActive: boolean;
}

export type MaintenanceInfoDocument = HydratedDocument<MaintenanceInfo>;

export const MaintenanceInfoSchema =
  SchemaFactory.createForClass(MaintenanceInfo);

export const maintenanceInfoModel = {
  name: MaintenanceInfo.name,
  schema: MaintenanceInfoSchema,
};