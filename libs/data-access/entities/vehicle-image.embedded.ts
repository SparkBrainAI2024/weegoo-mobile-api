import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ImageStatus } from "@libs/data-access/enums/upload.enum";

@ObjectType()
export class VehicleImage {
  @Field()
  s3Key: string;

  @Field(() => String)
  status: ImageStatus;    // ACTIVE | INACTIVE

  @Field()
  createdAt: Date;
}

// Mongoose raw schema for use inside @Prop
export const VehicleImageSchema = {
  s3Key:     { type: String, required: true },
  status:    { type: String, enum: ImageStatus, required: true, default: ImageStatus.ACTIVE },
  createdAt: { type: Date, default: () => new Date() },
};