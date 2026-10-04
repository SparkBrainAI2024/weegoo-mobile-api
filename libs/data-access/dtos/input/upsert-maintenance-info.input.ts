import { Field, InputType } from "@nestjs/graphql";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

@InputType()
export class UpsertMaintenanceInfoInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  message: string;

  /**
   * Toggle maintenance mode on/off. Defaults to `true` when omitted so the
   * existing admin flow (just saving a message) puts the app in maintenance.
   */
  @Field(() => Boolean, { nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}