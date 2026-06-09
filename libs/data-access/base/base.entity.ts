import { Field, ObjectType } from '@nestjs/graphql';
import { Prop } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@ObjectType({ isAbstract: true })
export class BaseEntity {
  @Field(() => String)
  _id: Types.ObjectId;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: Date.now })
  createdAt?: Date;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: Date.now })
  updatedAt?: Date;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date })
  deletedAt?: Date;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  @Prop({ type: Boolean, default: false })
  deleted?: boolean;
}
