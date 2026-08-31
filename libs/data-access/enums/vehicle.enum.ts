import { registerEnumType } from "@nestjs/graphql";

export enum VehicleType {
  JEEP = "JEEP",
  MICRO = "MICRO",
  CAR = "CAR",
  MOTORBIKE = "MOTORBIKE",
  SCOOTER = "SCOOTER",
}
export enum VehicleModelType {
  EV='EV',
  PETROL='PETROL'
}

registerEnumType(VehicleType, {
  name: "VehicleType",
});
registerEnumType(VehicleModelType, {
  name: "VehicleModelType",
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

/**
 * Union of every vehicle type accepted anywhere a vehicle type is provided —
 * i.e. both the on-demand VehicleType values and the ScheduledVehicleType
 * values. Used by inputs that must accept either enum (mirrors the storage
 * enum on the Vehicle entity).
 */
export enum AnyVehicleType {
  JEEP = "JEEP",
  MICRO = "MICRO",
  CAR = "CAR",
  MOTORBIKE = "MOTORBIKE",
  SCOOTER = "SCOOTER",
}
registerEnumType(AnyVehicleType, {
  name: "AnyVehicleType",
  description:
    "Any vehicle type: on-demand (CAR, MOTORBIKE, SCOOTER) or scheduled (JEEP, MICRO, CAR).",
});

/** All valid vehicle type values (deduplicated, for runtime validation). */
export const ALL_VEHICLE_TYPES: (VehicleType | ScheduledVehicleType)[] = [
  ...Object.values(VehicleType),
];
