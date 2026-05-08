export interface AppEnv {
  // Application
  APP_ENV: 'test' | 'development' | 'production' | string;
  PORT: number;

  // Database
  DB_CONNECTION_URL: string;
  DATABASE_URL: string;
  DATABASE_URL_TEST: string;

  // JWT
  JWT_SECRET_KEY: string;
  JWT_SECRET: string;
  JWT_EXPIRATION: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRATION: string;
  ACCESS_TOKEN_LIFE: string;
  REFRESH_TOKEN_LIFE: string;
  RESET_PASSWORD_TOKEN_LIFE: string;

  // Google OAuth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  GOOGLE_SCOPE: string[];
  GOOGLE_MAP_API_KEY: string;

  // AWS S3
  AWS_ACCESS_KEY_ID: string;
  AWS_S3_SECRET_KEY: string;
  S3_BUCKET_NAME: string;
  AWS_REGION: string;
  AWS_S3_UPLOAD_PREFIX: string;

  // Support Email
  SUPPORT_EMAIL: string;
  SUPPORT_EMAIL_AUTH: string;

  // Production URL
  PRODUCTION_URL: string;

  MAIL_HOST: string;
  MAIL_PORT: number;
  MAIL_USER: string;
  MAIL_PASS: string;
}

export default (): AppEnv => ({
  // Application
  APP_ENV: process.env.APP_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  // Database
  DB_CONNECTION_URL: process.env.DB_CONNECTION_URL || 'mongodb://localhost:27017/ride_hailing',
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://username:password@localhost:5432/ride_hailing_db',
  DATABASE_URL_TEST: process.env.DATABASE_URL_TEST || 'postgres://username:password@localhost:5432/ride_hailing_test_db',

  // JWT
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY || process.env.JWT_SECRET || 'your_jwt_secret',
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '1h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret',
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION || '7d',
  ACCESS_TOKEN_LIFE: process.env.ACCESS_TOKEN_LIFE || '5d',
  REFRESH_TOKEN_LIFE: process.env.REFRESH_TOKEN_LIFE || '30d',
  RESET_PASSWORD_TOKEN_LIFE: process.env.RESET_PASSWORD_TOKEN_LIFE || '10m',

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  GOOGLE_SCOPE: process.env.GOOGLE_SCOPE ? process.env.GOOGLE_SCOPE.split(',') : ['email', 'profile'],
  GOOGLE_MAP_API_KEY: process.env.GOOGLE_MAP_API_KEY || '',

  // AWS S3
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_S3_SECRET_KEY: process.env.AWS_S3_SECRET_KEY || '',
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || '',
  AWS_REGION: process.env.AWS_REGION || '',
  AWS_S3_UPLOAD_PREFIX: process.env.AWS_S3_UPLOAD_PREFIX || '',

  // Support Email
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || '',
  SUPPORT_EMAIL_AUTH: process.env.SUPPORT_EMAIL_AUTH || '',

  // Production URL
  PRODUCTION_URL: process.env.PRODUCTION_URL || '',

  //MAIL
  MAIL_HOST: process.env.MAIL_HOST || '',
  MAIL_PORT: parseInt(process.env.MAIL_PORT || '587', 10),
  MAIL_USER: process.env.MAIL_USER || '',
  MAIL_PASS: process.env.MAIL_PASS || '',
});
