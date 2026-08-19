// dtos/input/completed-rides.input.ts
import { Field, InputType } from "@nestjs/graphql";
import { IsDateString, IsNotEmpty } from "class-validator";

/**
 * Input for fetching all completed rides within a date range for the admin dashboard.
 * `fromDate` and `endDate` define an inclusive date range. Completed rides are
 * filtered by `rideCompletedAt` falling within [fromDate, endDate].
 */
@InputType()
export class CompletedRidesInput {
  @Field(() => Date, {
    description:
      "The start date (inclusive) of the date range for which to fetch completed rides.",
  })
  @IsNotEmpty()
  @IsDateString()
  fromDate: Date;

  @Field(() => Date, {
    description:
      "The end date (inclusive) of the date range for which to fetch completed rides.",
  })
  @IsNotEmpty()
  @IsDateString()
  endDate: Date;
}