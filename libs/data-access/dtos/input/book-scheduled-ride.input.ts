import { Field, ID, InputType } from "@nestjs/graphql";
import { IsNotEmpty } from "class-validator";

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
}
