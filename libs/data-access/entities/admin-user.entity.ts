// libs/data-access/src/entities/admin-user.entity.ts
import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { HydratedDocument } from "mongoose";

@ObjectType()
@Schema({ timestamps: true })
export class AdminUser extends BaseEntity {
  @Prop({ required: true, type: String })
  @Field(() => String)
  fullName: string;

  @Prop({ required: true, unique: true, type: String, index: true })
  @Field(() => String)
  email: string;

  @Prop({ required: true, type: String })
  password: string; // no @Field — never expose through GraphQL
}

export type AdminUserDocument = HydratedDocument<AdminUser>;
export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);

export const adminUserModel = {
  name: AdminUser.name,
  schema: AdminUserSchema,
};

AdminUserSchema.index({ email: 1, deleted: 1, deletedAt: 1 });