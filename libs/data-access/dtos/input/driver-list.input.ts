import { Field, InputType } from "@nestjs/graphql";
import { IsOptional, IsString } from "class-validator";
import { PaginationInputOnly } from "@libs/data-access/base/base.input";

@InputType()
export class DriverListInput extends PaginationInputOnly {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  status?: string; // "ACTIVE" | "PENDING" | "BLOCKED"
}
