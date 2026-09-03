import { Field, InputType, Float } from "@nestjs/graphql";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

/**
 * Input counterpart of {@link SavedLocation}.
 * Mirrors the driver's `workLocation` field so availability pickup/drop-off
 * locations share the exact same shape (address + latitude + longitude).
 */
@InputType()
export class SavedLocationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
