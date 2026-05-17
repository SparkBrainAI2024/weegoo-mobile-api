import { Injectable } from "@nestjs/common";
import { S3Service } from "@libs/s3";
import { RequestUploadResponse } from "@libs/data-access/dtos/response/request-upload.response";
import { UploadPurpose } from "@libs/data-access/enums/upload.enum";

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

    // Return presigned PUT URL
    return this.s3.getUploadUrl(s3Key, contentType);
  }
}