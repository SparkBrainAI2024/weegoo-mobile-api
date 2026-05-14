export interface PresignedUploadResult {
  uploadUrl:        string;
  s3Key:            string;
  expiresInSeconds: number;
}