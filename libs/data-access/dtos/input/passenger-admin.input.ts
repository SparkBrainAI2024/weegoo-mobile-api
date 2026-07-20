import { Field, ID, InputType } from "@nestjs/graphql";

@InputType()
export class RiderTripsInput {
  @Field(() => ID) riderId: string;
  @Field({ nullable: true, defaultValue: 0 }) page?: number;
  @Field({ nullable: true, defaultValue: 10 }) limit?: number;
  @Field({ nullable: true }) search?: string;
  @Field({ nullable: true }) status?: string;
  @Field({ nullable: true }) paymentMethod?: string;
}

@InputType()
export class RiderRatingsInput {
  @Field(() => ID) riderId: string;
  @Field({ nullable: true, defaultValue: 0 }) page?: number;
  @Field({ nullable: true, defaultValue: 10 }) limit?: number;
}
