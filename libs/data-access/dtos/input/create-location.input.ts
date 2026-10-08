import { Field, Float, InputType } from "@nestjs/graphql";
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { LocationStatus } from "../../enums/location.enum";
import { AddSubLocationInput } from "./sub-location.input";

/**
 * Creates a location, optionally together with its sub-locations: every entry
 * of `subLocations` is created in the same call. More sub-locations can still
 * be added afterwards, one by one, through `addSubLocation`.
 *
 * Sub-locations of one location must be unique — neither the address nor the
 * latitude/longitude pair may be used twice.
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

  @Field(() => Float, {
    description: "Latitude of the location",
    nullable: true,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Field(() => Float, {
    description: "Longitude of the location",
    nullable: true,
  })
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

  @Field(() => [AddSubLocationInput], {
    nullable: "itemsAndList",
    description:
      "Nullable: the list and its entries may be omitted or null. Sub-locations to create together with the location; each one is validated (unique address and unique latitude/longitude).",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddSubLocationInput)
  subLocations?: AddSubLocationInput[];
}
