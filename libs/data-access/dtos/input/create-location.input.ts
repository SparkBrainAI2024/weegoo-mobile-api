import { Field, Float, InputType } from "@nestjs/graphql";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { LocationStatus } from "../../enums/location.enum";

/**
 * Creates a location on its own — without any sub-location.
 * Sub-locations are added afterwards, one by one, through `addSubLocation`.
 */
@InputType()
export class CreateLocationInput {
  @Field(() => String, {
    description: "Display name of the location (must be unique)",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @Field(() => Float, { description: "Latitude of the location" })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Field(() => Float, { description: "Longitude of the location" })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @Field(() => LocationStatus, {
    nullable: true,
    defaultValue: LocationStatus.ACTIVE,
    description: "Status of the location; defaults to ACTIVE",
  })
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;
}
