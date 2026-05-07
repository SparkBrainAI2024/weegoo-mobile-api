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

}
