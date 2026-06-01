export const initialWalletBalance = 0;
export const passwordRegex = /(?=.*[A-Z]).*$/;
export const phoneRegex = /^(?:\+977)?9[78]\d{8}$/;
export const passwordSalt = 12;
export const userOtpSalt = 5;
export const userOtpExpiredTime = 120; // in seconds
export const AUTHORIZATION_HEADER = "authorization";
export const LANG_HEADER = "lang";

export const tokenTypes = {
  refreshToken: "refresh_token",
  accessToken: "access_token",
  resetPasswordToken: "reset_password_token",
  changeEmailToken: "change_email_token",
  setPasswordToken: "set_password_token",
};
export const allowedFileExtensions = ["jpg", "jpeg", "png", "webp"];
export * from "./required-sides.constant";
export const MATCHMAKING_CONFIG = {
  // ─── INSTANT Ride Config ───
  INITIAL_RADIUS_KM: 1,
  FALLBACK_RADII_KM: [1, 2, 4, 7, 10],
  MAX_ATTEMPTS: 5,
  FIRST_ATTEMPT_WAIT_SECONDS: 15,
  SUBSEQUENT_ATTEMPT_WAIT_SECONDS: 20,

  // ─── SCHEDULED Ride Config ───
  SCHEDULED_FALLBACK_RADII_KM: [1, 3, 5, 10, 15],
  SCHEDULED_ATTEMPT_WAIT_SECONDS: 20,

  // ─── Shared Config ───
  MAX_DRIVERS_PER_RING: 50,
  REQUEST_BATCH_SIZE: 5,
  MIN_ACCEPT_RATING: 4.0,
  BYPASS_RATING_AFTER_ATTEMPTS: 2,

  SCORING: {
    DISTANCE_WEIGHT: 0.6,
    RATING_WEIGHT: -0.3,
    COMPLETED_TRIPS_WEIGHT: 0.1,
  },

  // ─── INSTANT Fare Config ───
  FARE: {
    BASE_PICKUP_COST: 1.0,
    PER_KM_RATE: 1.2,
    PER_MINUTE_RATE: 0.3,
  },

  // ─── SCHEDULED Fare Config (multiplicative) ───
  SCHEDULED_FARE: {
    PER_KM_RATE: 1.2,
    PER_MINUTE_RATE: 0.3,
    RIDE_TYPE_MULTIPLIER: { CAR: 1.0, MOTORBIKE: 0.7 },
    RAIN_MULTIPLIER: { light: 1.1, heavy: 1.3 },
    SCHEDULED_TRAFFIC_MULTIPLIER: { moderate: 1.2, heavy: 1.4 },
  },

  USER_CANCELLATION_LIMIT_PER_MONTH: 3,
};
