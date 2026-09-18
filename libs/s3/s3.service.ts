import { HttpStatus, Injectable } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UploadPurpose } from "@libs/data-access/enums/upload.enum";
import {
  ALLOWED_CONTENT_TYPES_BY_PURPOSE,
  CONTENT_TYPE_TO_EXT,
  DEFAULT_UPLOAD_EXPIRES_SECONDS,
} from "./s3.constants";
import { ErrorException, generateNanoId } from "@libs/common";

@Injectable()
export class S3Service {
  private readonly bucket = process.env.S3_BUCKET_NAME || "";
  private readonly region = process.env.AWS_REGION || "us-east-1";
  private readonly prefix = (process.env.AWS_S3_UPLOAD_PREFIX || "").replace(
    /\/$/,
    "",
  );

  private readonly client = new S3Client({
    region: this.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_S3_SECRET_KEY || "",
    },
  });

  /**
   * Client for the public bucket (AWS_PUBLIC_BUCKET / AWS_PUBLIC_REGION).
   * Credentials are shared with the primary client; only the region differs.
   * Created lazily so we don't build it when the public bucket isn't used.
   */
  private publicClient?: S3Client;

  private getPublicBucketClient(): S3Client {
    if (!this.publicClient) {
      const publicRegion = process.env.AWS_PUBLIC_REGION || this.region;
      this.publicClient = new S3Client({
        region: publicRegion,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_S3_SECRET_KEY || "",
        },
      });
    }
    return this.publicClient;
  }

  // ─── Key builder ─────────────────────────────────────────────────────────────
  buildKey(
    purpose: UploadPurpose,
    ownerId: string,
    contentType: string,
  ): string {
    const ext = CONTENT_TYPE_TO_EXT[contentType];
    if (!ext)
      ErrorException(null, "S3.INVALID_CONTENT_TYPE", HttpStatus.BAD_REQUEST);
    const d = new Date();
    const ymd = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    return [
      this.prefix,
      purpose.toLowerCase(),
      ownerId,
      ymd,
      `${generateNanoId()}.${ext}`,
    ]
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

  async getUploadUrl(
    key: string,
    contentType = "application/octet-stream",
    expiresIn = DEFAULT_UPLOAD_EXPIRES_SECONDS,
  ) {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn });
    return { uploadUrl, s3Key: key, expiresInSeconds: expiresIn };
  }

  /**
   * Presigned PUT URL against the public bucket (AWS_PUBLIC_BUCKET /
   * AWS_PUBLIC_REGION). Used for publicly-readable assets such as profile and
   * vehicle images so uploads land in the same bucket their read URLs point to.
   * Falls back to the primary upload bucket when the public bucket is not
   * configured.
   */
  async getPublicBucketUploadUrl(
    key: string,
    contentType = "application/octet-stream",
    expiresIn = DEFAULT_UPLOAD_EXPIRES_SECONDS,
  ) {
    if (!this.isPublicBucketConfigured()) {
      return this.getUploadUrl(key, contentType, expiresIn);
    }

    const cmd = new PutObjectCommand({
      Bucket: process.env.AWS_PUBLIC_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    // Sign against a client in the public bucket's region — signing with the
    // primary client fails with an S3 region mismatch when AWS_PUBLIC_REGION
    // differs from AWS_REGION.
    const uploadUrl = await getSignedUrl(this.getPublicBucketClient(), cmd, {
      expiresIn,
    });
    return { uploadUrl, s3Key: key, expiresInSeconds: expiresIn };
  }

  isPublicBucketConfigured(): boolean {
    return Boolean(
      process.env.AWS_PUBLIC_BUCKET && process.env.AWS_PUBLIC_REGION,
    );
  }

  async getViewUrl(key: string, expiresIn: number): Promise<string> {
    if (expiresIn > 604800) {
      throw new Error("getViewUrl: expiresIn exceeds AWS maximum of 604800s");
    }
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }

  async getDownloadUrl(
    s3Key: string,
    expiresInSeconds: number,
    filename?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ResponseContentDisposition: filename
        ? `attachment; filename="${filename}"`
        : "attachment",
    });
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  getPublicUrl(s3Key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`;
  }

  // ─── Public bucket URL ────────────────────────────────────────────────────────
  /**
   * Public bucket URL used for publicly-readable assets such as profile images,
   * vehicle images and car-icon.svg. Falls back to the primary upload bucket
   * when AWS_PUBLIC_BUCKET / AWS_PUBLIC_REGION are not configured.
   */
  getPublicBucketUrl(s3Key: string): string {
    const publicBucketName = process.env.AWS_PUBLIC_BUCKET || "";
    const publicBucketRegion = process.env.AWS_PUBLIC_REGION || "";
    if (publicBucketName && publicBucketRegion) {
      return `https://${publicBucketName}.s3.${publicBucketRegion}.amazonaws.com/${s3Key}`;
    }
    return this.buildObjectUrl(s3Key);
  }
}
