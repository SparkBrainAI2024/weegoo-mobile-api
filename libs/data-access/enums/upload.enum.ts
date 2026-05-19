import { registerEnumType } from "@nestjs/graphql";

export enum UploadPurpose {
  USER_PROFILE_IMAGE = "USER_PROFILE_IMAGE",
  VEHICLE_IMAGE      = "VEHICLE_IMAGE",
  LICENSE     = "LICENSE",
  BLUEBOOK    = "BLUEBOOK",
  NATIONAL_ID = "NATIONAL_ID",
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