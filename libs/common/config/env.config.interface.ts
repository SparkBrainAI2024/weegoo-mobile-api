export enum EmailProvider {
  /** Nodemailer email provider */
  NODEMAILER = 'nodemailer',
}

/**
 * Database configuration interface.
 */
export interface DatabaseConfig {
  /** MongoDB connection URI */
  uri: string;
}

/**
 * GraphQL configuration interface.
 */
export interface GraphqlConfig {
  /** GraphQL endpoint path */
  endpoint: string;
  /** Enable GraphQL introspection */
  introspection: boolean;
  /** Path to auto-generated schema file */
  autoSchema: string | boolean;
}

/**
 * JWT configuration interface.
 */
export interface JwtConfig {
  /** Secret for access tokens */
  accessTokenSecret: string;
  /** Expiry for access tokens */
  accessTokenExpiresIn: string;
  /** Secret for refresh tokens */
  refreshTokenSecret: string;
  /** Expiry for refresh tokens */
  refreshTokenExpiresIn: string;
  /** JWT issuer */
  issuer: string;
  /** JWT audience (string or string array) */
  audience: string | string[];
}

/**
 * Redis configuration interface.
 */
export interface RedisConfig {
  /** Redis host */
  host: string;
  /** Redis port */
  port: number;
  /** Redis password (optional) */
  password?: string;
  /** Redis TLS configuration */
  tls: boolean;
}


/**
 * Nodemailer configuration interface.
 */
export interface NodeMailerConfig {
  /** Nodemailer host */
  host: string;

  /** Nodemailer port */
  port: number;

  /** Use secure connection */
  secure: boolean;

  /** Nodemailer service */
  service: string;

  /** Nodemailer authentication details */
  auth: {
    /** Authentication type */
    type: string;
    /** Username for authentication */
    user: string;
    /** Password for authentication */
    pass: string;
  };
}

/**
 * Email configuration interface.
 */
export interface EmailConfig {
  /** Provider */
  provider: EmailProvider;

  /** Default from address */
  from: string;

  /** Admin support email */
  adminSupportEmail: string;

  /** Link expiration time */
  emailLinksExpiresIn: string;

  /** Reset password link expiration time */
  resetLinksExpiresIn: string;

  /** Email resend interval in milliseconds */
  resendInterval: number;

  /** Nodemailer configuration (optional) */
  nodemailer?: NodeMailerConfig;
}

/**
 * MailChimp configuration interface.
 * Contains API key and server prefix.
 */
export interface MailChimpConfig {
  /** MailChimp API key */
  apiKey: string;

  /** MailChimp server prefix */
  serverPrefix: string; // e.g., 'us1'

  /** MailChimp list ID  */
  listId: string;
}

/**
 * AWS configuration interface.
 * Contains S3 and CloudFront configuration details.
 */
export interface AWSConfig {
  /** S3 access key ID */
  accessKeyId: string;

  /** S3 secret access key */
  secretAccessKey: string;

  /* S3 region */
  region: string;

  /** S3 bucket name */
  bucketName: string;

  /** Expiration time for upload presigned url */
  uploadLinkExpiresIn: number;

  /** Expiration time for get presigned url */
  signedUrlExpiresIn: number;

  /** CloudFront configuration */
  cloudfront: {
    /** CloudFront domain */
    domain: string;
    /** CloudFront distribution ID */
    distributionId: string;
    /** CloudFront private key */
    privateKey: string;
    /** CloudFront key pair ID */
    keyPairId: string;
  };
}

/**
 * Social authentication configuration interface.
 * Contains Google and Facebook OAuth configuration.
 */
export interface SocialAuthConfig {
  /** Google OAuth configuration */
  google: {
    /** Google client ID */
    clientId: string;
    /** Google client secret */
    clientSecret: string;
    /** Google redirect URI */
    redirectUri: string;
    /** Google OAuth scopes */
    scope: string[];
  };
  /** Facebook OAuth configuration */
  facebook: {
    /** Facebook app ID */
    appId: string;
    /** Facebook app secret */
    appSecret: string;
    /** Facebook redirect URI */
    redirectUri: string;
    /** Facebook OAuth scopes */
    scope: string[];
  };
}

/** Shared Configs */
export interface ISharedConfig {
  /** Application environment (e.g., development, production, staging, uat) */
  environment: string;

  /** Application name */
  appName: string;

  /** Node environment (e.g., development, production) */
  nodeEnv: string;

  /** Application port */
  port: number;

  /** Number of salt rounds for password hashing */
  saltRounds: number;

  /** Database configuration */
  database: DatabaseConfig;

  /** GraphQL configuration */
  graphql: GraphqlConfig;

  /** Redis configuration */
  redis: RedisConfig;

  /** Email configuration */
  email: EmailConfig;

  /** JWT configuration */
  jwt: JwtConfig;

  /** AWS configuration */
  aws: AWSConfig;

  /** Google Maps API key */
  googleMapApiKey: string;

  /** Support email address */
  supportEmail: string;

  /** Support email auth */
  supportEmailAuth: string;

  /** Google OAuth client ID */
  googleClientId: string;

  /** Google OAuth client secret */
  googleClientSecret: string;

  /** Production URL */
  productionUrl: string;
}

/**
 * Environment variables configuration interface.
 * Contains all environment variables from .env files across all apps.
 */
export interface EnvConfig {
  /** Application environment (e.g., development, production, staging, test) */
  APP_ENV: 'test' | 'development' | 'production' | string;

  /** Application port */
  PORT: number;

  /** MongoDB connection URL */
  DB_CONNECTION_URL: string;

  /** PostgreSQL database URL */
  DATABASE_URL: string;

  /** Test database URL */
  DATABASE_URL_TEST: string;

  /** JWT secret key */
  JWT_SECRET_KEY: string;

  /** JWT secret */
  JWT_SECRET: string;

  /** JWT expiration time */
  JWT_EXPIRATION: string;

  /** JWT refresh secret */
  JWT_REFRESH_SECRET: string;

  /** JWT refresh expiration time */
  JWT_REFRESH_EXPIRATION: string;

  /** Access token life duration */
  ACCESS_TOKEN_LIFE: string;

  /** Refresh token life duration */
  REFRESH_TOKEN_LIFE: string;

  /** Reset password token life duration */
  RESET_PASSWORD_TOKEN_LIFE: string;

  /** Google OAuth client ID */
  GOOGLE_CLIENT_ID: string;

  /** Google OAuth client secret */
  GOOGLE_CLIENT_SECRET: string;

  /** Google OAuth redirect URI */
  GOOGLE_REDIRECT_URI: string;

  /** Google OAuth scopes */
  GOOGLE_SCOPE: string[];

  /** Google Maps API key */
  GOOGLE_MAP_API_KEY: string;

  /** AWS access key ID */
  AWS_ACCESS_KEY_ID: string;

  /** AWS S3 secret key */
  AWS_S3_SECRET_KEY: string;

  /** AWS S3 bucket name */
  S3_BUCKET_NAME: string;

  /** AWS region */
  AWS_REGION: string;

  /** AWS S3 upload prefix */
  AWS_S3_UPLOAD_PREFIX: string;

  /** Support email address */
  SUPPORT_EMAIL: string;

  /** Support email auth */
  SUPPORT_EMAIL_AUTH: string;

  /** Production URL */
  PRODUCTION_URL: string;
}
