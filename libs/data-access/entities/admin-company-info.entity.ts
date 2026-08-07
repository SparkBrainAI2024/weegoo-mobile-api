import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BaseEntity } from "../base/base.entity";

@ObjectType()
@Schema({ timestamps: true })
export class AdminCompanyInfo extends BaseEntity {
  @Field(() => String)
  @Prop({ required: true, type: String, trim: true })
  companyName: string;

  @Field(() => String)
  @Prop({ required: true, type: String, trim: true, lowercase: true })
  supportEmail: string;
}

export type AdminCompanyInfoDocument = HydratedDocument<AdminCompanyInfo>;

export const AdminCompanyInfoSchema =
  SchemaFactory.createForClass(AdminCompanyInfo);

export const adminCompanyInfoModel = {
  name: AdminCompanyInfo.name,
  schema: AdminCompanyInfoSchema,
};