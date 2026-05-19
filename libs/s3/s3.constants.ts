import { UploadPurpose } from "@libs/data-access/enums/upload.enum";

export const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
};

export const ALLOWED_CONTENT_TYPES_BY_PURPOSE: Record<UploadPurpose, string[]> = {
  [UploadPurpose.USER_PROFILE_IMAGE]: ["image/jpeg", "image/png", "image/webp"],
  [UploadPurpose.VEHICLE_IMAGE]:      ["image/jpeg", "image/png", "image/webp"],
  [UploadPurpose.LICENSE]:     ["image/jpeg", "image/png", "image/webp"],
  [UploadPurpose.BLUEBOOK]:    ["image/jpeg", "image/png", "image/webp"],
  [UploadPurpose.NATIONAL_ID]: ["image/jpeg", "image/png", "image/webp"],
};

export const DEFAULT_UPLOAD_EXPIRES_SECONDS       = 300;      // 5 min PUT presign window
export const VIEW_URL_EXPIRES_DRIVER_SECONDS      = 900;      // 15 min driver self-view
export const VIEW_URL_EXPIRES_ADMIN_SECONDS       = 604800;   // 7 days admin review
export const VIEW_URL_CACHE_TTL_SECONDS           = 601200;   // 6d 23h Redis cache TTL