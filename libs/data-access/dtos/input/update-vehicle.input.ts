import {  VehicleModelType, VehicleType } from "@libs/data-access";
import { Field, InputType, Int } from "@nestjs/graphql";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

@InputType()
export class EditVehicleInput {
  @Field({ nullable: true, description: "S3 key for the new vehicle image." })
  @IsNotEmpty()
  @IsString()
  imageS3Key: string;

  @Field(() => VehicleType, { nullable: true, description: "Vehicle type: CAR, MOTORBIKE, or SCOOTER." })
  @IsNotEmpty()
  @IsEnum(VehicleType, { message: "VEHICLE.INVALID_TYPE" })
  vehicleType?: VehicleType;

  @Field({ nullable: true, description: "Vehicle model name, for example: Honda City." })
  @IsNotEmpty()
  @IsString({ message: "VEHICLE.MODEL_INVALID" })
  vehicleModel?: string;

  @Field(() => Int, { nullable: true, description: "Manufacturing year of the vehicle." })
  @IsNotEmpty()
  @IsInt({ message: "VEHICLE.YEAR_INVALID" })
  @Min(1900, { message: "VEHICLE.YEAR_INVALID" })
  @Max(2100, { message: "VEHICLE.YEAR_INVALID" })
  year?: number;

  @Field({ nullable: true, description: "Number plate (must be unique across other vehicles)." })
  @IsNotEmpty()
  @IsString({ message: "VEHICLE.NUMBER_PLATE_INVALID" })
  numberPlate?: string;

  @Field({ nullable: true, description: "Vehicle color, for example: White, Red, Black." })
  @IsNotEmpty()
  @IsString({ message: "VEHICLE.COLOR_INVALID" })
  color?: string;

    @Field(() => VehicleModelType, { nullable: true, description: "Vehicle model Type type: EV or PETROL." })
  @IsNotEmpty()
  @IsEnum(VehicleModelType, { message: "VEHICLE.INVALID_MODEL_TYPE" })
  vehicleModelType?: VehicleModelType;

  
  @Field(()=> String)
  @IsNotEmpty()
  @IsString()
  name: string;
}