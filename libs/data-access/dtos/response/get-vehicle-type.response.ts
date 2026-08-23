import { Field, ObjectType } from "@nestjs/graphql";
import { VehicleType, ScheduledVehicleType } from "../../enums/vehicle.enum";

/**
 * Response for the getVehicleType query.
 *
 * Depending on the requested ride preference:
 * - INSTANT   -> instantVehicleTypes = [CAR, MOTORBIKE, SCOOTER], scheduledVehicleTypes = []
 * - SCHEDULED -> instantVehicleTypes = [], scheduledVehicleTypes = [JEEP, CAR, MICRO]
 * - BOTH      -> both arrays are populated
 */
@ObjectType()
export class GetVehicleTypeResponse {
  @Field(() => [VehicleType], {
    description:
      "Vehicle types available for instant rides (CAR, MOTORBIKE, SCOOTER). Empty when the ride preference is SCHEDULED.",
  })
  instantVehicleTypes: VehicleType[];

  @Field(() => [ScheduledVehicleType], {
    description:
      "Vehicle types available for scheduled rides (JEEP, CAR, MICRO). Empty when the ride preference is INSTANT.",
  })
  scheduledVehicleTypes: ScheduledVehicleType[];
}