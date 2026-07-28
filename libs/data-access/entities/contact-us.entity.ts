import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { BaseEntity } from '../base/base.entity';
import { ContactUsStatus } from '../enums/contact-us.enum';

@ObjectType()
@Schema({ timestamps: true })
export class ContactUs extends BaseEntity {
  @Field(() => String)
  @Prop({ required: true, type: String })
  name: string;

  @Field(() => String)
  @Prop({ required: true, type: String })
  email: string;

  @Field(() => String)
  @Prop({ required: true, type: String })
  mobileNumber: string;

  @Field(() => String)
  @Prop({ required: true, type: String })
  message: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  userId?: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: String, default: null })
  userRole?: string;

  @Field(() => ContactUsStatus)
  @Prop({ type: String, enum: ContactUsStatus, default: ContactUsStatus.ACTIVE })
  status: ContactUsStatus;
}

export type ContactUsDocument = HydratedDocument<ContactUs>;

export const ContactUsSchema = SchemaFactory.createForClass(ContactUs);

export const contactUsModel = {
  name: ContactUs.name,
  schema: ContactUsSchema,
};