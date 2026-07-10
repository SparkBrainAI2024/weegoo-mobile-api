import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { HydratedDocument } from "mongoose";

@ObjectType()
@Schema({ timestamps: true })
export class Remark extends BaseEntity {
  @Field(() => String, { description: "Display name / text of the remark" })
  @Prop({ type: String, required: true })
  name: string;
}

export type RemarkDocument = HydratedDocument<Remark>;
export const RemarkSchema = SchemaFactory.createForClass(Remark);

export const remarkModel = {
  name: Remark.name,
  schema: RemarkSchema,
};