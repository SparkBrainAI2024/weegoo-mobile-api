import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendUserConfirmation(email, otp: number) {
    return await this.mailerService.sendMail({
      to: email,
      from: '"Ride Hailing App" <no-reply@ride-hailing.com>',
      subject: "Welcome to Ride Hailing App! Confirm your Email",
      template: "./templates/verify",
      context: {
        email: email,
        otp,
      },
    });
  }

  async sendResetPassword(email, otp: number) {
    return await this.mailerService.sendMail({
      to: email,
      from: '"Ride Hailing App" <no-reply@ride-hailing.com>',
      subject: "Reset Your Password",
      template: "./templates/resetPassword",
      context: {
        email: email,
        otp,
      },
    });
  }
}
