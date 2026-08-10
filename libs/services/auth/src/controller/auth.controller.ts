import { Controller, Get, Query, Res, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "../auth.service";
import { VerifyEmailTokenInput } from "@libs/data-access";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * REST endpoint for email verification.
   * Users click the link in the email which hits this endpoint.
   * Example: GET /verify-email?token=xxx
   */
  @Get("verify-email")
  async verifyEmail(
    @Query("token") token: string,
    @Res() res: Response,
  ) {
    try {
      const input: VerifyEmailTokenInput = { token };
      const result = await this.authService.verifyEmail(input, "EN");

      // Return a simple HTML page for browser display
      return res.status(HttpStatus.OK).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <title>Email Verified</title>
          <style>
            body {
              margin: 0;
              padding: 40px 20px;
              background: #f3f4f6;
              font-family: Arial, Helvetica, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .card {
              background: #ffffff;
              border-radius: 12px;
              padding: 40px;
              max-width: 400px;
              width: 100%;
              text-align: center;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              border: 1px solid #dbeafe;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #081329;
              font-size: 24px;
              margin: 0 0 12px 0;
            }
            p {
              color: #64748b;
              font-size: 16px;
              line-height: 1.6;
              margin: 0;
            }
            .button {
              display: inline-block;
              margin-top: 24px;
              padding: 14px 32px;
              background-color: #081329;
              color: #ffd21f;
              text-decoration: none;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>Email Verified Successfully!</h1>
            <p>Your email has been verified. You can now close this page and continue using the app.</p>
            <a class="button" href="/">Go to Home</a>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Return error HTML page
      return res.status(HttpStatus.BAD_REQUEST).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <title>Verification Failed</title>
          <style>
            body {
              margin: 0;
              padding: 40px 20px;
              background: #f3f4f6;
              font-family: Arial, Helvetica, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .card {
              background: #ffffff;
              border-radius: 12px;
              padding: 40px;
              max-width: 400px;
              width: 100%;
              text-align: center;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              border: 1px solid #fecaca;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #dc2626;
              font-size: 24px;
              margin: 0 0 12px 0;
            }
            p {
              color: #64748b;
              font-size: 16px;
              line-height: 1.6;
              margin: 0;
            }
            .button {
              display: inline-block;
              margin-top: 24px;
              padding: 14px 32px;
              background-color: #dc2626;
              color: #ffffff;
              text-decoration: none;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">❌</div>
            <h1>Verification Failed</h1>
            <p>${errorMessage}</p>
            <a class="button" href="/">Go to Home</a>
          </div>
        </body>
        </html>
      `);
    }
  }
}