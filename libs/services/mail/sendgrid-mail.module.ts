import { Module } from "@nestjs/common";
import { EnvService } from "@libs/common/config/env.service";
import { EmailTemplatePersistenceModule } from "@libs/services/email-template/src/email-template.persistence.module";
import { EmailTemplateParserService } from "@libs/services/email-template/src/email-template-parser.service";
import { SendGridMailService } from "./sendgrid-mail.service";

/**
 * Module that wires together the SendGrid mail service with its dependencies:
 * - EnvService for reading SendGrid configuration from environment
 * - EmailTemplatePersistenceModule for fetching dynamic email templates from DB
 * - EmailTemplateParserService for rendering dynamic content in the base template
 */
@Module({
  imports: [EmailTemplatePersistenceModule],
  providers: [SendGridMailService, EmailTemplateParserService, EnvService],
  exports: [SendGridMailService, EmailTemplateParserService],
})
export class SendGridMailModule {}