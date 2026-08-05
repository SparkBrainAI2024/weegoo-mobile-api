import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EmailTemplate, EmailTemplateSchema } from "@libs/data-access";
import { EmailTemplateRepository } from "@libs/data-access/repositories/email-template.repository";
import { EmailTemplateService } from "./email-template.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
    ]),
  ],
  providers: [EmailTemplateRepository, EmailTemplateService],
  exports: [EmailTemplateService, EmailTemplateRepository, MongooseModule],
})
export class EmailTemplatePersistenceModule {}