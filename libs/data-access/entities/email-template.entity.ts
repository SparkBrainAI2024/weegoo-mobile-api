import { Field, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { HydratedDocument } from "mongoose";
import { paginateAndSoftDelete } from "../plugins/mongoose.plugin";

export type EmailTemplateDocument = HydratedDocument<EmailTemplate>;

@ObjectType()
@Schema({ timestamps: true })
export class EmailTemplate extends BaseEntity {
  @Prop({ required: true, type: String })
  @Field(() => String)
  title: string;

  @Prop({ required: true, type: String, unique: true, index: true })
  @Field(() => String)
  slug: string;

  @Prop({ required: true, type: String })
  @Field(() => String)
  pageContent: string;

  @Prop({
    required: true,
    type: String,
    enum: ["PUBLISHED", "DRAFT"],
    default: "DRAFT",
    index: true,
  })
  @Field(() => String)
  status: string;
}

export const EmailTemplateSchema = SchemaFactory.createForClass(EmailTemplate);
export const emailTemplateModel = {
  name: EmailTemplate.name,
  schema: EmailTemplateSchema,
};

EmailTemplateSchema.plugin(paginateAndSoftDelete);