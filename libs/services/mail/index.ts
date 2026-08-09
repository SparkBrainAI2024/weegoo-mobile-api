import { Injectable } from "@nestjs/common";
import { SendGridMailService } from "./sendgrid-mail.service";

/**
 * MailService that sends emails via SendGrid.
 * Replaces the old Nodemailer-based implementation.
 */
@Injectable()
export class MailService {
  constructor(private readonly sendGridMailService: SendGridMailService) {}

  /**
   * Send user email confirmation OTP via SendGrid.
   */
  async sendUserConfirmation(email: string, otp: number) {
    const content = `
      <h2>Welcome to Ride Hailing App!</h2>
      <p>Your email confirmation OTP is: <strong>${otp}</strong></p>
      <p>Please use this code to verify your email address.</p>
    `;
    return await this.sendGridMailService.sendParsedEmail({
      to: email,
      subject: "Welcome to Ride Hailing App! Confirm your Email",
      content,
    });
  }

  /**
   * Send password reset OTP via SendGrid.
   */
  async sendResetPassword(email: string, otp: number) {
    const content = `
      <h2>Reset Your Password</h2>
      <p>Your password reset OTP is: <strong>${otp}</strong></p>
      <p>Please use this code to reset your password.</p>
    `;
    return await this.sendGridMailService.sendParsedEmail({
      to: email,
      subject: "Reset Your Password",
      content,
    });
  }

  /**
   * Send contact us notification via SendGrid.
   */
  async sendContactUsEmail(data: {
    name: string;
    email: string;
    mobileNumber: string;
    message: string;
  }) {
    const content = `
      <h2>New Contact Us Message</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Mobile Number:</strong> ${data.mobileNumber}</p>
      <p><strong>Message:</strong> ${data.message}</p>
    `;
    return await this.sendGridMailService.sendParsedEmail({
      to: data.email,
      subject: "New Contact Us Message",
      content,
    });
  }
}

export * from "./sendgrid-mail.service";
export * from "./sendgrid-mail.module";