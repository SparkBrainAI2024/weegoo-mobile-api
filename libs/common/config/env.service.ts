import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Generic environment service that provides type-safe access to environment variables.
 * This service can be used across all apps and libs to access environment configuration.
 */
@Injectable()
export class EnvService {
  constructor(private readonly configService: ConfigService) { }

  /**
   * Get a string environment variable with a default value
   */
  getString(key: string, defaultValue?: string): string {
    return this.configService.get<string>(key) || defaultValue || '';
  }

  /**
   * Get a number environment variable with a default value
   */
  getNumber(key: string, defaultValue?: number): number {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null) {
      return defaultValue ?? 0;
    }
    return parseInt(value, 10);
  }

  /**
   * Get a boolean environment variable with a default value
   */
  getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null) {
      return defaultValue ?? false;
    }
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.getString('APP_ENV', 'development') === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.getString('APP_ENV', 'development') === 'production';
  }

  /**
   * Check if running in test mode
   */
  isTest(): boolean {
    return this.getString('APP_ENV', 'development') === 'test';
  }

  // ==========================================
  // Auth-specific helper methods
  // ==========================================

  /**
   * Get JWT secret key
   */
  getJwtSecretKey(): string {
    return this.getString('JWT_SECRET_KEY') || this.getString('JWT_SECRET') || 'your_jwt_secret';
  }

  /**
   * Get access token expiration time
   */
  getAccessTokenLife(): string {
    return this.getString('ACCESS_TOKEN_LIFE', '5d');
  }

  /**
   * Get refresh token expiration time
   */
  getRefreshTokenLife(): string {
    return this.getString('REFRESH_TOKEN_LIFE', '30d');
  }

  /**
   * Get reset password token expiration time
   */
  getResetPasswordTokenLife(): string {
    return this.getString('RESET_PASSWORD_TOKEN_LIFE', '2m');
  }

  /**
   * Get password salt rounds
   */
  getPasswordSalt(): number {
    return this.getNumber('PASSWORD_SALT', 12);
  }

  /**
   * Get user OTP salt
   */
  getUserOtpSalt(): number {
    return this.getNumber('USER_OTP_SALT', 5);
  }

  /**
   * Get user OTP expiration time in seconds
   */
  getUserOtpExpiredTime(): number {
    return this.getNumber('USER_OTP_EXPIRED_TIME', 300);
  }

  // ==========================================
  // Database-specific helper methods
  // ==========================================

  /**
   * Get database connection URL
   */
  getDbConnectionString(): string {
    return this.getString('DB_CONNECTION_URL', 'mongodb://localhost:27017/ride_hailing');
  }

  // ==========================================
  // Application-specific helper methods
  // ==========================================

  /**
   * Get application environment
   */
  getAppEnv(): string {
    return this.getString('APP_ENV', 'development');
  }

  /**
   * Get application port
   */
  getPort(): number {
    return this.getNumber('PORT', 3000);
  }

  /**
   * Get application host
   */
  getHost(): string {
    return this.getString('HOST', '0.0.0.0');
  }

  getGoogleClientId(): string {
    return this.getString('GOOGLE_CLIENT_ID', '');
  }

  getGoogleClientSecret(): string {
    return this.getString('GOOGLE_CLIENT_SECRET', '');
  }

  // ==========================================
  // AWS-specific helper methods
  // ==========================================

  /**
   * Get AWS access key ID
   */
  getAwsAccessKeyId(): string {
    return this.getString('AWS_ACCESS_KEY_ID', '');
  }

  /**
   * Get AWS S3 secret key
   */
  getAwsS3SecretKey(): string {
    return this.getString('AWS_S3_SECRET_KEY', '');
  }

  /**
   * Get S3 bucket name
   */
  getS3BucketName(): string {
    return this.getString('S3_BUCKET_NAME', '');
  }

  /**
   * Get AWS region
   */
  getAwsRegion(): string {
    return this.getString('AWS_REGION', '');
  }

  /**
   * Get AWS S3 upload prefix
   */
  getAwsS3UploadPrefix(): string {
    return this.getString('AWS_S3_UPLOAD_PREFIX', '');
  }

  // ==========================================
  // Support Email helper methods
  // ==========================================

  /**
   * Get support email address
   */
  getSupportEmail(): string {
    return this.getString('SUPPORT_EMAIL', '');
  }

  /**
   * Get support email auth
   */
  getSupportEmailAuth(): string {
    return this.getString('SUPPORT_EMAIL_AUTH', '');
  }

  // ==========================================
  // Google Maps helper methods
  // ==========================================

  /**
   * Get Google Maps API key
   */
  getGoogleMapApiKey(): string {
    return this.getString('GOOGLE_MAP_API_KEY', '');
  }

  // ==========================================
  // Database URL helper methods
  // ==========================================

  /**
   * Get PostgreSQL database URL
   */
  getDatabaseUrl(): string {
    return this.getString('DB_CONNECTION_URL');
  }


  // ==========================================
  // Production URL helper methods
  // ==========================================

  /**
   * Get production URL
   */
  getProductionUrl(): string {
    return this.getString('PRODUCTION_URL', '');
  }

  getMailHost(): string {
    return this.getString('MAIL_HOST', '');
  }
  getMailPort(): number {
    return this.getNumber('MAIL_PORT', 587);
  }
  getMailUser(): string {
    return this.getString('MAIL_USER', '');
  }
  getMailPass(): string {
    return this.getString('MAIL_PASS', '');
  }
  getFirebaseProjectId(): string {
    return this.getString('FIREBASE_PROJECT_ID', '');
  }
  getFirebaseClientEmail(): string {
    return this.getString('FIREBASE_CLIENT_EMAIL', '');
  }
  getFirebasePrivateKey(): string {
    return this.getString('FIREBASE_PRIVATE_KEY', '');
  }

  // ==========================================
  // Ably-specific helper methods
  // ==========================================

  /**
   * Get Ably API key
   */
  getAblyApiKey(): string {
    return this.getString('ABLY_API_KEY', '');
  }

  // ==========================================
  // eSewa helper methods
  // ==========================================

  /**
   * Get eSewa merchant/service code (SCD). Test: EPAYTEST
   */
  getEsewaMerchantCode(): string {
    return this.getString('ESEWA_MERCHANT_CODE', 'EPAYTEST');
  }

  /**
   * Get eSewa secret key for Epay-v2 HMAC verification.
   */
  getEsewaSecretKey(): string {
    return this.getString('ESEWA_SECRET_KEY', '');
  }

  /**
   * Get eSewa client ID for OAuth2 flow.
   */
  getEsewaClientId(): string {
    return this.getString('ESEWA_CLIENT_ID', '');
  }

  /**
   * Get eSewa client secret for OAuth2 flow.
   */
  getEsewaClientSecret(): string {
    return this.getString('ESEWA_CLIENT_SECRET', '');
  }

  // ==========================================
  // Khalti helper methods
  // ==========================================

  /**
   * Get Khalti public key for Checkout SDK.
   */
  getKhaltiPublicKey(): string {
    return this.getString('KHALTI_PUBLIC_KEY', 'test_public_key');
  }

  /**
   * Get Khalti secret key for verification.
   */
  getKhaltiSecretKey(): string {
    return this.getString('KHALTI_SECRET_KEY', 'test_secret_key');
  }

  // ==========================================
  // Baato API helper methods
  // ==========================================

  /**
   * Get Baato API key for distance calculation
   */
  getBaatoApiKey(): string {
    return this.getString('BAATO_API_KEY', 'bpk.sMFRR7lmyMy-6jnTdq9oopV8q5C8KHHM6Q-Tj_8jooND');
  }

  /**
   * Get Baato API base URL
   */
  getBaatoApiUrl(): string {
    return this.getString('BAATO_API_URL', 'https://api.baato.io/api/v1');
  }
  
}