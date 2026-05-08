import { Field, InputType } from "@nestjs/graphql";
import {
  IsNotEmpty,
  IsString,
  IsIn,
  IsArray,
  ArrayNotEmpty,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

@InputType()
export class GeoLocationInput {
  @Field()
  @IsNotEmpty({ message: "USER.REQUIRED_GEOLOCATION_TYPE" })
  @IsString({ message: "USER.INVALID_GEOLOCATION_TYPE" })
  @IsIn(["Point"], { message: "USER.INVALID_GEOLOCATION_TYPE" })
  type: string;

  @Field(() => [Number])
  @IsArray({ message: "USER.INVALID_GEOLOCATION_COORDINATES" })
  @ArrayNotEmpty({ message: "USER.REQUIRED_GEOLOCATION_COORDINATES" })
  @ArrayMinSize(2, { message: "USER.MIN_GEOLOCATION_COORDINATES" })
  @Type(() => Number)
  coordinates: [number, number];
}
