import { Injectable } from "@nestjs/common";
import { S3Service } from "@libs/s3";
import { RequestUploadResponse } from "@libs/data-access/dtos/response/request-upload.response";
import { UploadPurpose } from "@libs/data-access/enums/upload.enum";

/** Purposes whose assets are publicly readable and live in the public bucket */
const PUBLIC_BUCKET_PURPOSES: UploadPurpose[] = [
  UploadPurpose.USER_PROFILE_IMAGE,
  UploadPurpose.PROFILE_IMAGE,
  UploadPurpose.VEHICLE_IMAGE,
];

@Injectable()
export class UploadCenterService {
  constructor(private readonly s3: S3Service) {}

  async requestUpload(params: {
    ownerId:     string;
    purpose:     UploadPurpose;
    contentType: string;
  }): Promise<RequestUploadResponse> {
    const { ownerId, purpose, contentType } = params;

    // Validate content type for this purpose
    this.s3.validateContentType(purpose, contentType);

    // Generate key — nothing saved to DB
    const s3Key = this.s3.buildKey(purpose, ownerId, contentType);

    // Return presigned PUT URL — public assets (profile/vehicle images) go to
    // the public bucket, everything else to the private upload bucket
    if (PUBLIC_BUCKET_PURPOSES.includes(purpose)) {
      return this.s3.getPublicBucketUploadUrl(s3Key, contentType);
    }
    return this.s3.getUploadUrl(s3Key, contentType);
  }
}