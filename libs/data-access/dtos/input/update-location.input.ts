import { Field, Float, InputType } from "@nestjs/graphql";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/**
 * Updates the location's own fields. Sub-locations are managed separately
 * (`addSubLocation`, `updateSubLocation`, `updateSubLocationStatus`,
 * `removeSubLocation`).
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
}
