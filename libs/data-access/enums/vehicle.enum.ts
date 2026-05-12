import { registerEnumType } from "@nestjs/graphql";

export enum VehicleType {
  CAR = "CAR",
  MOTORBIKE = "MOTORBIKE",
  SCOOTER = "SCOOTER",
}

registerEnumType(VehicleType, {
  name: "VehicleType",
});