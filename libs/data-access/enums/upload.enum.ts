import { registerEnumType } from "@nestjs/graphql";

export enum UploadPurpose {
  USER_PROFILE_IMAGE = "USER_PROFILE_IMAGE",
  VEHICLE_IMAGE      = "VEHICLE_IMAGE",
  DRIVER_LICENSE     = "DRIVER_LICENSE",
  DRIVER_BLUEBOOK    = "DRIVER_BLUEBOOK",
  DRIVER_NATIONAL_ID = "DRIVER_NATIONAL_ID",
  PROFILE_IMAGE    = "PROFILE_IMAGE",
}

export enum ImageStatus {
  ACTIVE   = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum DocumentFileStatus {
  PENDING            = "PENDING",
  VERIFIED           = "VERIFIED",
  REJECTED           = "REJECTED",
  REUPLOAD_REQUESTED = "REUPLOAD_REQUESTED",
}

registerEnumType(UploadPurpose,       { name: "UploadPurpose"       });
registerEnumType(ImageStatus,         { name: "ImageStatus"         });
registerEnumType(DocumentFileStatus,  { name: "DocumentFileStatus"  });