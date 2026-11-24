import { Module } from "@nestjs/common";
import { InvoiceService } from "./invoice.service";
import { S3Service } from "@libs/s3";
import { EmailTemplateParserService } from "@libs/services/email-template/src/email-template-parser.service";
import { SendGridMailService } from "@libs/services/mail";

@Module({
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}