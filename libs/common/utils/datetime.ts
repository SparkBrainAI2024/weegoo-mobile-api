import moment from "moment-timezone";
import { userOtpExpiredTime } from "../constants";

export const currentLocalTime = (timezone, format) => {
    return moment.tz(moment.now(), timezone).format(format);
};

export const UTCTime = () => {
    return new Date(new Date().toUTCString());
};

export const currentUTCTime = (format) => {
    return moment().utc().format(format);
};

export const localToUtcTime = (time, timezone, format) => {
    return moment.tz(time, timezone).utc().format(format);
};

export const isOtpExpired = (createdAt: Date,userOtpExpiredTime: number
): boolean => {
    const currentTime = new Date();
    const otpCreationTime = new Date(createdAt).getTime();
    const currentTimeMs = currentTime.getTime();
    const expirationTimeMs = otpCreationTime + (userOtpExpiredTime * 1000); // Convert to milliseconds
    return currentTimeMs > expirationTimeMs;
  }
