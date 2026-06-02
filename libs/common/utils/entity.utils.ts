import { PublicImage } from "@libs/data-access/common/public-image.entity";
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
  profileImages: PublicImage[],
  getPublicUrl: (key: string) => string,
): string => {
  const key = profileImages?.find(img => img.status === ImageStatus.ACTIVE)?.s3Key;
  return key ? getPublicUrl(key) : "";
};