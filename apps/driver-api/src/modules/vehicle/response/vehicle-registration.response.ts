import { Field, ObjectType } from "@nestjs/graphql";
import { Vehicle } from "../entities/vehicle.entity";

@ObjectType()
export class VehicleRegistrationResponse {
  @Field()
  message: string;

  @Field()
  success: boolean;

  @Field(() => Vehicle, { nullable: true })
  vehicle?: Vehicle;
}