import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { EnvService } from "@libs/common/config/env.service";

/**
 * Sparrow SMS (sparrowsms.com) SMS service.
 *
 * Uses the Sparrow "Push SMS (MT)" API:
 *   POST https://api.sparrowsms.com/v2/sms/
 *   form fields: token, from (identity), to (10-digit number), text
 *
 * Sending is best-effort: a failed SMS must never block the OTP/sign-up
 * flow (same approach as the best-effort welcome email in UserDetailsService).
 */
@Injectable()
export class SparrowSmsService {
  private readonly logger = new Logger(SparrowSmsService.name);

  constructor(private readonly envService: EnvService) {}

  /**
   * Send an SMS via the Sparrow Push SMS API.
   *
   * @param to - Recipient phone number (any format; normalized to 10 digits)
   * @param text - Message body
   */
  async sendSms(to: string, text: string): Promise<void> {
    try {
      const token = this.envService.getSparrowSmsToken();
      const from = this.envService.getSparrowSmsIdentity();
      const url = this.envService.getSparrowSmsApiUrl();
     
      if (!token || !from) {
        this.logger.warn(
          "SPARROW_SMS_TOKEN / SPARROW_SMS_IDENTITY are not set. Skipping SMS sending. Please configure them in your .env file.",
        );
        return;
      }

      const normalizedTo = this.normalizePhoneNumber(to);
      if (!normalizedTo) {
        this.logger.warn(`Invalid phone number "${to}". Skipping SMS sending.`);
        return;
      }

      const params = new URLSearchParams();
      params.append("token", token);
      params.append("from", from);
      params.append("to", normalizedTo);
      params.append("text", text);

      const response = await axios.post(url, params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      });

      const result = response.data as { response_code?: number; response?: string };
      if (result?.response_code !== 200) {
        // Sparrow returns error codes in a 200/4xx body, e.g. 1002 = invalid token
        throw new Error(
          `Sparrow SMS error ${result?.response_code}: ${result?.response ?? "unknown error"}`,
        );
      }

      this.logger.log(`SMS sent successfully to ${normalizedTo}`);
    } catch (error) {
      console.log("🚀 ~ file: sparrow-sms.service.ts ~ SparrowSmsService ~ sendSms ~ error:", error)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send SMS to ${to}: ${errorMessage}`);
    }
  }

  /**
   * Send the phone verification OTP to a user's phone.
   */
  async sendVerificationSms(phone: string, otp: number | string): Promise<void> {
    return this.sendSms(
      phone,
      `Your verification OTP is: ${otp}. Please use this code to verify your phone number.`,
    );
  }

  /**
   * Normalize a phone number to the 10-digit local number required by
   * Sparrow SMS (e.g. "+977-98XX-XXX-XXX" → "98XXXXXXXX").
   */
  private normalizePhoneNumber(phone: string): string {
    const digits = (phone || "").replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  }
}
