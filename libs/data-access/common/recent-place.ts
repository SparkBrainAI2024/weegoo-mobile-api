 import { Field, ObjectType, Float } from '@nestjs/graphql';
import { Prop } from '@nestjs/mongoose';

@ObjectType()
export class RecentPlaceLocation {
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

@ObjectType()
export class RecentPlace {
  @Field(() => RecentPlaceLocation, { nullable: true })
  @Prop({ type: Object, default: null })
  pickupLocation?: RecentPlaceLocation;

  @Field(() => RecentPlaceLocation, { nullable: true })
  @Prop({ type: Object, default: null })
  dropoffLocation?: RecentPlaceLocation;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: null })
  createdAt?: Date;
}