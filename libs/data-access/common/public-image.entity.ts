import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { ImageStatus } from "@libs/data-access/enums/upload.enum";

@ObjectType()
export class PublicImage {
  @Field()
  @Prop({ type: String, required: true })
  s3Key?: string;

  @Field(() => ImageStatus)
  @Prop({ type: String, enum: ImageStatus, required: true, default: ImageStatus.ACTIVE })
  status?: ImageStatus;

  @Field()
  @Prop({ type: Date, default: () => new Date() })
  createdAt?: Date;
}