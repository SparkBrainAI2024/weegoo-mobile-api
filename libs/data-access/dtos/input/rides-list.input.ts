// dtos/request/rides-list.input.ts
import { Field, InputType, Int, registerEnumType } from "@nestjs/graphql";
import { RideStatus } from "../../enums/rides.enum";
import { IsEnum, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

export enum RideTimeRange {
  LAST_24_HOURS = "LAST_24_HOURS",
  LAST_7_DAYS = "LAST_7_DAYS",
  LAST_30_DAYS = "LAST_30_DAYS",
}

registerEnumType(RideTimeRange, {
  name: "RideTimeRange",
  description: "Fixed time-range filter for the rides list",
});

@InputType()
export class RidesListInput {
  @Field(() => RideStatus, { nullable: true })
  @IsOptional()
  @IsEnum(RideStatus)
  status?: RideStatus;

  @Field(() => RideTimeRange, { defaultValue: RideTimeRange.LAST_24_HOURS })
  @IsEnum(RideTimeRange)
  timeRange: RideTimeRange;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => Int, { defaultValue: 1 })
  @Type(() => Number)
  @Min(1)
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  @Type(() => Number)
  @Min(1)
  limit: number;
}
