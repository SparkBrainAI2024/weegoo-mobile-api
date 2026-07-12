import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";

@ObjectType()
export class RatingUserSnapshot {
  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  fullName?: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  profileImage?: string;

  @Field(() => Number, { defaultValue: 0 })
  @Prop({ type: Number, default: 0 })
  rating?: number;

  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  phone?: string;
}