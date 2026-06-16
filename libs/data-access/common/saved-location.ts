import { Field, ObjectType, Float } from '@nestjs/graphql';
import { Prop } from '@nestjs/mongoose';

@ObjectType()
export class SavedLocation {
  @Field(() => String, { nullable: true })
  @Prop({ type: String, default: null })
  address?: string;

  @Field(() => Float, { nullable: true })
  @Prop({ type: Number, default: null })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  @Prop({ type: Number, default: null })
  longitude?: number;
}