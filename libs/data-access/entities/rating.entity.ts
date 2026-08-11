import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { Remark } from "./remark.entity";
import { HydratedDocument, Types } from "mongoose";
import { RideUserSnapshot } from "../common/ride-user-snapshot";

@ObjectType()
@Schema({ timestamps: true })
export class Rating extends BaseEntity {
  @Field(() => Number)
  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: Types.ObjectId, required: true, ref: "User", index: true })
  ratedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: "User", index: true })
  ratedTo: Types.ObjectId;

  @Field(() => RideUserSnapshot, { nullable: true, description: "Snapshot of the rater user details" })
  @Prop({ type: RideUserSnapshot, required: false })
  ratedByUser?: RideUserSnapshot;

  @Field(() => RideUserSnapshot, { nullable: true, description: "Snapshot of the rated user details" })
  @Prop({ type: RideUserSnapshot, required: false })
  ratedToUser?: RideUserSnapshot;

  @Field(() => String)
  @Prop({ type: Types.ObjectId, required: true, ref: "Rides", index: true })
  rideId: Types.ObjectId;

  @Field(() => String, { nullable: true })
  @Prop({ type: String, required: false })
  ratingRemarks?: string;

  @Field(() => String, { nullable: true, description: "Remark text provided by the user" })
  @Prop({ type: String, required: false })
  remarkByUser?: string;
}

export type RatingDocument = HydratedDocument<Rating>;
export const RatingSchema = SchemaFactory.createForClass(Rating);

export const ratingModel = {
  name: Rating.name,
  schema: RatingSchema,
};

RatingSchema.index({ ratedBy: 1, rideId: 1 }, { unique: true });
RatingSchema.index({ ratedTo: 1 });