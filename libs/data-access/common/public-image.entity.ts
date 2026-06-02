import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { ImageStatus } from "@libs/data-access/enums/upload.enum";

@ObjectType()
export class PublicImage {
  @Field()
  @Prop({ type: String, required: true })
  @ApiProperty({ nullable: false })
  s3Key: string;

  @Field(() => ImageStatus)
  @Prop({ type: String, enum: ImageStatus, required: true, default: ImageStatus.ACTIVE })
  @ApiProperty({ enum: ImageStatus, nullable: false })
  status: ImageStatus;

  @Field()
  @Prop({ type: Date, default: () => new Date() })
  @ApiProperty({ nullable: false })
  createdAt: Date;
}