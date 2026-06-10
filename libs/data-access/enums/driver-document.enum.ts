// apps/driver-api/src/modules/driver-document/enums/driver-document.enum.ts

import { registerEnumType } from "@nestjs/graphql";

export enum DriverDocumentType {
  NATIONAL_ID      = "NATIONAL_ID",
  DRIVING_LICENSE  = "DRIVING_LICENSE",
  BLUEBOOK         = "BLUEBOOK",
}

export enum DriverDocumentSide {
  FRONT              = "FRONT",
  BACK               = "BACK",
  VEHICLE_INFO_PAGE  = "VEHICLE_INFO_PAGE",
  TAX_CLEARANCE_PAGE = "TAX_CLEARANCE_PAGE",
}

export enum DriverDocumentBundleStatus {
  DRAFT          = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED       = "APPROVED",
  REJECTED       = "REJECTED",
  NOT_SUBMITTED   = "NOT_SUBMITTED",
}

export enum DriverDocumentStatusCheck {
  SUBMITTED= "SUBMITTED",
  ACTION_NEEDED= "ACTION_NEEDED",
  REVIEWED= "REVIEWED",
  REJECTED = "REJECTED",
}


registerEnumType(DriverDocumentType,         { name: "DriverDocumentType"         });
registerEnumType(DriverDocumentSide,         { name: "DriverDocumentSide"         });
registerEnumType(DriverDocumentBundleStatus, { name: "DriverDocumentBundleStatus" });
registerEnumType(DriverDocumentStatusCheck,  { name: "DriverDocumentStatusCheck"  });
