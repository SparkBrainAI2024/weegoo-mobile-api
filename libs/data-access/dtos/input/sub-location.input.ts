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
 * Adds ONE sub-location to an existing location.
 * Calling it repeatedly adds sub-locations one by one.
 */
@InputType()
export class AddSubLocationInput {
  @Field(() => String, { description: "Address of the sub-location" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  address: string;

  @Field(() => Float, { description: "Latitude of the sub-location" })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Field(() => Float, { description: "Longitude of the sub-location" })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @Field(() => LocationStatus, {
    nullable: true,
    defaultValue: LocationStatus.ACTIVE,
    description: "Status of the sub-location; defaults to ACTIVE",
  })
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;
}

/**
 * Updates the fields of one sub-location inside a location.
 * Only the provided fields are changed.
 */
@InputType()
export class UpdateSubLocationInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  address?: string;

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
