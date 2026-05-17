import { Field, ObjectType } from "@nestjs/graphql";
import { BasicResponse } from "@libs/data-access";
import { Vehicle } from "@libs/data-access/entities/vehicle.entity";

@ObjectType()
export class VehicleRegistrationResponse {
  @Field()
  message: string;

  @Field()
  success: boolean;

  @Field(() => Vehicle, { nullable: true })
  vehicle?: Vehicle;
}

// @ObjectType()
// export class GetMyVehiclesResponse extends BasicResponse{
//   @Field()
//   vehicles: Vehicle[];
// }