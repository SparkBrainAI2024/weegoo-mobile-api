import { Injectable, Logger } from "@nestjs/common";
import sgMail from "@sendgrid/mail";
import { EnvService } from "@libs/common/config/env.service";
import { EmailTemplateParserService } from "@libs/services/email-template/src/email-template-parser.service";
import { EmailTemplateRepository } from "@libs/data-access/repositories/email-template.repository";

export interface SendEmailOptions {
  /** Recipient email address(es) */
  to: string | string[];
  /** Email subject */
  subject: string;
  /** Slug of the email template stored in DB */
  templateSlug: string;
  /** Optional variables to replace in the template (e.g., { userName: 'John' }) */
  variables?: Record<string, any>;
  /** Optional CC recipients */
  cc?: string | string[];
  /** Optional BCC recipients */
  bcc?: string | string[];
  /** Optional attachments */
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
  }>;
}

/**
 * SendGrid-based email service that:
 * - Fetches dynamic email templates from the database by slug
 * - Parses dynamic content (links → buttons, fixes broken buttons)
 * - Renders content inside the base WeeGoo email template
 * - Sends emails via SendGrid API
 */
@Injectable()
export class SendGridMailService {
  private readonly logger = new Logger(SendGridMailService.name);
  private initialized = false;

  constructor(
    private readonly envService: EnvService,
    private readonly emailTemplateParserService: EmailTemplateParserService,
    private readonly emailTemplateRepository: EmailTemplateRepository,
  ) {}

  /**
   * Initialize SendGrid with the API key from environment.
   */
  private initialize(): void {
    if (this.initialized) {
      return;
    }

    const apiKey = this.envService.getSendGridApiKey();
    if (!apiKey) {
      this.logger.warn(
        "SENDGRID_API_KEY is not set. Email sending will fail. Please configure it in your .env file.",
      );
      return;
    }

    sgMail.setApiKey(apiKey);
    this.initialized = true;
  }

  /**
   * Send an email using a dynamic email template from the database.
   *
   * @param options - Email sending options
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    try {
      this.initialize();

      const { to, subject, templateSlug, variables, cc, bcc, attachments } =
        options;

      // 1. Fetch the email template from the database
      const emailTemplate = await this.emailTemplateRepository.findBySlug(
        templateSlug,
      );

      if (!emailTemplate) {
        this.logger.error(
          `Email template with slug "${templateSlug}" not found in database.`,
        );
        throw new Error(
          `Email template with slug "${templateSlug}" not found in database.`,
        );
      }

      if (emailTemplate.status !== "PUBLISHED") {
        this.logger.warn(
          `Email template "${templateSlug}" is not PUBLISHED (status: ${emailTemplate.status}). Sending anyway...`,
        );
      }

      // 2. Parse the dynamic content and render it inside the base template
      const html = this.emailTemplateParserService.parseAndRender(
        emailTemplate.pageContent,
        variables,
      );

      // 3. Build the SendGrid message
      const fromEmail = this.envService.getSendGridFromEmail();
      const fromName = this.envService.getSendGridFromName();

      const msg: sgMail.MailDataRequired = {
        to,
        from: fromName
          ? { email: fromEmail, name: fromName }
          : fromEmail,
        subject,
        html,
        ...(cc && { cc }),
        ...(bcc && { bcc }),
        ...(attachments && { attachments }),
      };

      // 4. Send via SendGrid
      await sgMail.send(msg);

      this.logger.log(
        `Email sent successfully to ${Array.isArray(to) ? to.join(", ") : to} using template "${templateSlug}"`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email using template "${options.templateSlug}": ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Send a raw HTML email without using a database template.
   * Useful for one-off emails or testing.
   */
  async sendRawEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Array<{
      content: string;
      filename: string;
      type?: string;
      disposition?: string;
    }>;
  }): Promise<void> {
    try {
      this.initialize();

      const { to, subject, html, cc, bcc, attachments } = options;

      const fromEmail = this.envService.getSendGridFromEmail();
      const fromName = this.envService.getSendGridFromName();

      const msg: sgMail.MailDataRequired = {
        to,
        from: fromName
          ? { email: fromEmail, name: fromName }
          : fromEmail,
        subject,
        html,
        ...(cc && { cc }),
        ...(bcc && { bcc }),
        ...(attachments && { attachments }),
      };

      await sgMail.send(msg);

      this.logger.log(
        `Raw email sent successfully to ${Array.isArray(to) ? to.join(", ") : to}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send raw email: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Send an email with inline content (no database template).
   * The content will be parsed (links → buttons) and rendered in the base template.
   */
  async sendParsedEmail(options: {
    to: string | string[];
    subject: string;
    content: string;
    variables?: Record<string, any>;
    cc?: string | string[];
    bcc?: string | string[];
  }): Promise<void> {
    try {
      this.initialize();

      const { to, subject, content, variables, cc, bcc } = options;

      // Parse the content and render it inside the base template
      const html = this.emailTemplateParserService.parseAndRender(
        content,
        variables,
      );

      const fromEmail = this.envService.getSendGridFromEmail();
      const fromName = this.envService.getSendGridFromName();

      const msg: sgMail.MailDataRequired = {
        to,
        from: fromName
          ? { email: fromEmail, name: fromName }
          : fromEmail,
        subject,
        html,
        ...(cc && { cc }),
        ...(bcc && { bcc }),
      };

      await sgMail.send(msg);

      this.logger.log(
        `Parsed email sent successfully to ${Array.isArray(to) ? to.join(", ") : to}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send parsed email: ${errorMessage}`);
      throw error;
    }
  }
}