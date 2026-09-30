import { Field, Float, InputType } from "@nestjs/graphql";
import {
  IsArray,
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
import { AddSubLocationInput } from "./sub-location.input";

/**
 * Updates the location's own fields and/or creates new sub-locations for it.
 *
 * Existing sub-locations are still managed separately (`updateSubLocation`,
 * `updateSubLocationStatus`, `removeSubLocation`).
 *
 * Named `...Master...` to distinguish it from the driver's live-location
 * update input (`UpdateLocationInput`, latitude/longitude of a driver).
 */
@InputType()
export class UpdateLocationMasterInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @Field(() => [AddSubLocationInput], {
    nullable: "itemsAndList",
    description:
      "Nullable: the list and its entries may be omitted or null. New sub-locations to create for this location while updating it; each one is validated (unique address and unique latitude/longitude).",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddSubLocationInput)
  subLocations?: AddSubLocationInput[];
}
