import { registerEnumType } from "@nestjs/graphql";

export enum VehicleType {
  CAR = "CAR",
  MOTORBIKE = "MOTORBIKE",
  SCOOTER = "SCOOTER",
  JEEP = "JEEP",
  MICRO = "MICRO",
}
export enum VehicleModelType {
  EV='EV',
  PETROL='PETROL'
}

registerEnumType(VehicleType, {
  name: "VehicleType",
});
registerEnumType(VehicleModelType, {
  name: "VechileModelType",
});

/**
 * Separate enum for vehicle types eligible for **scheduled** ride bookings.
 * Only JEEP, MICRO, and CAR are offered for scheduled rides (unlike the
 * on-demand VehicleType which also includes MOTORBIKE and SCOOTER).
 */
export enum ScheduledVehicleType {
  JEEP = "JEEP",
  MICRO = "MICRO",
  CAR = "CAR",
}
registerEnumType(ScheduledVehicleType, {
  name: "ScheduledVehicleType",
});
