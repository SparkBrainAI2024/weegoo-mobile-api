import { Message } from "@libs/localization";
import { userOtpExpiredTime } from "@libs/common/constants";

/**
 * Returns the current Unix timestamp in seconds.
 */
export const getCurrentTimestamp = (): number => Math.floor(Date.now() / 1000);

/**
 * Calculates the remaining time in seconds until an OTP expires.
 */
export const getRemainingTime = (createdAt: Date): number => {
  const remaining = Math.floor((createdAt.getTime() / 1000 + userOtpExpiredTime) - getCurrentTimestamp());
  return remaining > 0 ? remaining : 0;
};

/**
 * Generates a standardized throttled response when an OTP is already active.
 */
export const getOtpThrottledResponse = (lang: string, createdAt: Date) => ({
  message: Message(lang, "USER.OTP_ALREADY_SENT"),
  success: true,
  currentTime: getCurrentTimestamp(),
  expiresBy: getRemainingTime(createdAt),
});

/**
 * Generates a standardized response for a successfully sent OTP.
 */
export const getOtpSentResponse = (lang: string, messageKey: string = "USER.OTP_SEND") => ({
  message: Message(lang, messageKey),
  success: true,
  currentTime: getCurrentTimestamp(),
  expiresBy: userOtpExpiredTime,
});

/**
 * Ensures the default role is present in the roles array without duplicates.
 */
export const getUpdatedRoles = (existingRoles: string[], defaultRole: string): string[] => {
  return [...new Set([...(existingRoles || []), defaultRole])];
};