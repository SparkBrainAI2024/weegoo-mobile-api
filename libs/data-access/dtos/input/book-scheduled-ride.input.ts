import { Field, ID, Float, InputType } from "@nestjs/graphql";
import { IsNotEmpty, IsOptional, Min } from "class-validator";

@InputType()
export class BookScheduledRideInput {
  /** The PENDING scheduled ride the passenger wants to book. */
  @Field(() => ID)
  @IsNotEmpty()
  rideId: string;

  /** The driver whose availability day the passenger is booking. */
  @Field(() => ID)
  @IsNotEmpty()
  driverId: string;

  /**
   * Optional amount the client expects to pay (total). When provided it is
   * validated against the server-computed booking amount — the driver's
   * availability-day amount multiplied by the number of seats (passengers)
   * booked. The wallet is always charged the server-computed amount.
   */
  @Field(() => Float, { nullable: true, description: "Optional expected total amount (availability day amount x seats booked). Validated server-side when provided." })
  @IsOptional()
  @Min(0)
  amount?: number;
}
