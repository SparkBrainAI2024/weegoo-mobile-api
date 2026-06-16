import { registerEnumType } from "@nestjs/graphql";

export enum VehicleType {
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
  name: "VechileModelType",
});