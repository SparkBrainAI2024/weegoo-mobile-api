import { VehicleModelType, VehicleType } from "@libs/data-access";
import { Field, InputType, Int } from "@nestjs/graphql";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

@InputType()
export class RegisterVehicleInput {
  @Field(() => VehicleType, {
    description:
      "Vehicle type registerVehicleenum: CAR, MOTORBIKE, or SCOOTER.",
  })
  @IsEnum(VehicleType, { message: "VEHICLE.INVALID_TYPE" })
  vehicleType: VehicleType;

  @Field({
    description: "Vehicle model name, for example: Honda City.",
  })
  @IsNotEmpty({ message: "VEHICLE.MODEL_REQUIRED" })
  @IsString({ message: "VEHICLE.MODEL_INVALID" })
  vehicleModel: string;

  @Field(() => Int, {
    description: "Manufacturing year of the vehicle.",
  })
  @IsInt({ message: "VEHICLE.YEAR_INVALID" })
  @Min(1900, { message: "VEHICLE.YEAR_INVALID" })
  @Max(2100, { message: "VEHICLE.YEAR_INVALID" })
  year: number;

  @Field({
    description: "Official number plate of the vehicle (must be unique).",
  })
  @IsNotEmpty({ message: "VEHICLE.NUMBER_PLATE_REQUIRED" })
  @IsString({ message: "VEHICLE.NUMBER_PLATE_INVALID" })
  numberPlate: string;

  @Field({
    description: "Vehicle color, for example: White, Red, Black.",
  })
  @IsNotEmpty({ message: "VEHICLE.COLOR_REQUIRED" })
  @IsString({ message: "VEHICLE.COLOR_INVALID" })
  color: string;

  @Field({ description: "S3 key for the vehicle image." })
  @IsNotEmpty()
  @IsString()
  imageS3Key: string;

  @Field(() => VehicleModelType, {
    nullable: true,
    description: "Vehicle model Type type: EV or PETROL.",
  })
  @IsNotEmpty()
  @IsEnum(VehicleModelType, { message: "VEHICLE.INVALID_MODEL_TYPE" })
  vehicleModelType?: VehicleModelType;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  name: string;
}
