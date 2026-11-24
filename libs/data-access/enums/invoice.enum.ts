import { registerEnumType } from "@nestjs/graphql";

export enum InvoiceCommissionCutOff {
  YES = "YES",
  NO = "NO",
}

export enum InvoiceLocationType {
  PICKUP = "PICKUP",
  DROP_OFF = "DROP_OFF",
}

export enum InvoiceAmountType {
  FROM = "FROM",
  TO = "TO",
}

registerEnumType(InvoiceCommissionCutOff, { name: "InvoiceCommissionCutOff" });
registerEnumType(InvoiceLocationType, { name: "InvoiceLocationType" });
registerEnumType(InvoiceAmountType, { name: "InvoiceAmountType" });