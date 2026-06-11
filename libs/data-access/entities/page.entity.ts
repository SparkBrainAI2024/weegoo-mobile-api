import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PageStatus, PageType } from '../enums/page.enum';

export type PageDocument = Page & Document;

@ObjectType()
@Schema({ timestamps: true })
export class Page {
  @Field(() => ID)
  _id: string;

  @Field(() => String)
  @Prop({ required: true, type: String, trim: true })
  title: string;

  // auto-generated from title via pre-save hook, used for URL routing
  @Field(() => String)
  @Prop({ required: true, type: String, unique: true, lowercase: true, trim: true, index: true })
  slug: string;

  @Field(() => PageType)
  @Prop({ required: true, type: String, enum: PageType })
  type: PageType;

  @Field(() => String)
  @Prop({ required: true, type: String })
  content: string;

  @Field(() => PageStatus)
  @Prop({ required: true, type: String, enum: PageStatus, default: PageStatus.DRAFT })
  status: PageStatus;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: null })
  publishedAt?: Date;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

export const PageSchema = SchemaFactory.createForClass(Page);

// pre-save hook to generate slug from title
PageSchema.pre('save', function (next) {
  if (this.isModified('title') || this.isNew) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  next();
});

// indexes for frequent queries
PageSchema.index({ status: 1 });
PageSchema.index({ type: 1 });
PageSchema.index({ createdAt: -1 });