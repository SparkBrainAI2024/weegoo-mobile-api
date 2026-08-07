import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

@InputType()
export class UpsertMaintenanceInfoInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  message: string;
}