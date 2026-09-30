import { Field, Float, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { LocationStatus } from "../enums/location.enum";

/**
 * A sub-location (address) that belongs to a {@link Location}.
 * Embedded inside the parent Location document — it has no life of its own,
 * but carries its own identifier so it can be managed individually.
 */
@ObjectType()
@Schema({ _id: true })
export class SubLocation {
  /**
   * Identifier of the sub-location inside its parent location document.
   * Mongoose generates it on `$push`, which lets every sub-location be
   * updated / activated / deactivated / deleted individually.
   */
  @Field(() => String, { nullable: true })
  _id?: Types.ObjectId;

  @Field(() => String)
  @Prop({ required: true, type: String, trim: true })
  address: string;

  @Field(() => Float)
  @Prop({ required: true, type: Number, min: -90, max: 90 })
  latitude: number;

  @Field(() => Float)
  @Prop({ required: true, type: Number, min: -180, max: 180 })
  longitude: number;

  /** ACTIVE | INACTIVE — every sub-location can be toggled on its own. */
  @Field(() => LocationStatus, { defaultValue: LocationStatus.ACTIVE })
  @Prop({
    required: true,
    type: String,
    enum: LocationStatus,
    default: LocationStatus.ACTIVE,
  })
  status: LocationStatus;
}

// Mongoose raw schema for use inside @Prop
export const SubLocationSchema = SchemaFactory.createForClass(SubLocation);
