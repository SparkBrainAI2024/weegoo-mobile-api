import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ImageStatus } from "@libs/data-access/enums/upload.enum";
import { PublicImage } from "./public-image.entity";

@ObjectType()
export class UserProfileImageEntity extends PublicImage {
  @Field({ nullable: true })
  @Prop({ type: String, required: false })
  socialPicture?: string;
}