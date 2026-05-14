import { Field, InputType } from "@nestjs/graphql";
import { IsMongoId, IsNotEmpty, IsString } from "class-validator";

@InputType()
export class UpdateVehicleImageInput {
  @Field()
  @IsMongoId()
  @IsNotEmpty()
  vehicleId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  s3Key: string;    // new image s3Key from requestUpload + client PUT
}