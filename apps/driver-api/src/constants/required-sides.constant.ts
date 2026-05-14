import { DriverDocumentSide, DriverDocumentType } from "../enums/driver-document.enum";

export const REQUIRED_SIDES: Record<DriverDocumentType, DriverDocumentSide[]> = {
  [DriverDocumentType.NATIONAL_ID]:     [DriverDocumentSide.FRONT, DriverDocumentSide.BACK],
  [DriverDocumentType.DRIVING_LICENSE]: [DriverDocumentSide.FRONT, DriverDocumentSide.BACK],
  [DriverDocumentType.BLUEBOOK]: [
    DriverDocumentSide.VEHICLE_INFO_PAGE,
    DriverDocumentSide.TAX_CLEARANCE_PAGE,
  ],
};