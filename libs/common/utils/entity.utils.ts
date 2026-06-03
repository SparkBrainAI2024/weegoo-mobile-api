import { PublicImage } from "@libs/data-access/common/public-image.entity";
import { UserProfileImageEntity } from "@libs/data-access/common/user-profile-image";
import { ImageStatus } from "@libs/data-access/enums/upload.enum";

export function transformToEntityNameObjectFromId(
  obj: Record<string, unknown>,
  [key, alias]: [string, string],
): Record<string, unknown> {
  if (obj[key] != null && typeof obj[key] === 'object') {
    obj[alias] = obj[key];
    delete obj[key];
  }
  return obj;
}



export const getActiveProfileImageUrl = (
  profileImages: UserProfileImageEntity[],
  getPublicUrl: (key: string) => string,
): string => {
  const social = profileImages?.find(img => img.socialPicture && img.status === ImageStatus.ACTIVE)?.socialPicture;
  if (social) return social;
  const key = profileImages?.find(img => img.status === ImageStatus.ACTIVE)?.s3Key;
  return key ? getPublicUrl(key) : "";
};