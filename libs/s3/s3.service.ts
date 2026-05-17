import { HttpStatus, Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadPurpose } from '@libs/data-access/enums/upload.enum';
import { ALLOWED_CONTENT_TYPES_BY_PURPOSE, CONTENT_TYPE_TO_EXT, DEFAULT_UPLOAD_EXPIRES_SECONDS } from './s3.constants';
import { ErrorException, generateNanoId } from '@libs/common';

@Injectable()
export class S3Service {
  private readonly bucket = process.env.S3_BUCKET_NAME || '';
  private readonly region = process.env.AWS_REGION || 'us-east-1';
  private readonly prefix = (process.env.AWS_S3_UPLOAD_PREFIX || "").replace(/\/$/, "");


  private readonly client = new S3Client({
    region: this.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_S3_SECRET_KEY || '',
    },
  });


  // ─── Key builder ─────────────────────────────────────────────────────────────
  buildKey(purpose: UploadPurpose, ownerId: string, contentType: string): string {
    const ext = CONTENT_TYPE_TO_EXT[contentType];
    if (!ext) ErrorException(null, "S3.INVALID_CONTENT_TYPE", HttpStatus.BAD_REQUEST);
    const d   = new Date();
    const ymd = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    return [this.prefix, purpose.toLowerCase(), ownerId, ymd, `${generateNanoId()}.${ext}`]
      .filter(Boolean)
      .join("/");
  }

   buildObjectUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

    // ─── Validate content type ────────────────────────────────────────────────────
  validateContentType(purpose: UploadPurpose, contentType: string): void {
    const allowed = ALLOWED_CONTENT_TYPES_BY_PURPOSE[purpose] ?? [];
    if (!allowed.includes(contentType)) {
      ErrorException(null, "S3.INVALID_CONTENT_TYPE", HttpStatus.BAD_REQUEST);
    }
  }



  async getUploadUrl(key: string, contentType = 'application/octet-stream',expiresIn   = DEFAULT_UPLOAD_EXPIRES_SECONDS,) {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    
      const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn });
    return { uploadUrl, s3Key: key, expiresInSeconds: expiresIn };
  }

  async getViewUrl(key: string, expiresIn: number): Promise<string> {
    if (expiresIn > 604800) {
      throw new Error("getViewUrl: expiresIn exceeds AWS maximum of 604800s");
    }
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }

   async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  getPublicUrl(s3Key: string): string {
  return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`;
}

}
