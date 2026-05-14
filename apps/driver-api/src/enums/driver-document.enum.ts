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
}