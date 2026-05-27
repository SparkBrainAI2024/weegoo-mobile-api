import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { roles } from "../enums/user.enum";

@ObjectType()
export class CancellationDetail {
  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: null })
  cancelledAt: Date;

  @Field(() => String, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: "User", default: null })
  cancelledBy: Types.ObjectId;

  @Field(() => String, { nullable: true })
  @Prop({ type: String, enum: roles, default: null })
  cancelledByRole: roles;

  @Field(() => String, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: "IssueCategory", default: null })
  cancelSubCategoryId: Types.ObjectId;

  @Field(() => String, { nullable: true })
  @Prop({ type: String, default: null })
  cancelSubCategoryLabel: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: String, default: null })
  cancelReasonContent?: string;
}