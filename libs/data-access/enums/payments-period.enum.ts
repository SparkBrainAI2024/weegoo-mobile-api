import { registerEnumType } from "@nestjs/graphql";

export enum PaymentsPeriodEnum {
  TODAY = "TODAY",
  THIS_WEEK = "THIS_WEEK",
  THIS_MONTH = "THIS_MONTH",
  THIS_YEAR = "THIS_YEAR",
  CUSTOM = "CUSTOM",
}

registerEnumType(PaymentsPeriodEnum, {
  name: "PaymentsPeriodEnum",
  description: "Time period filter for the payments dashboard",
});
