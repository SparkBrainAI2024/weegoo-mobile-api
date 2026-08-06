import { Module } from "@nestjs/common";
import { EmailTemplatePersistenceModule } from "@libs/services/email-template/src/email-template.persistence.module";
import { EmailTemplateResolver } from "@libs/services/email-template/src/email-template.resolver";
import { EmailTemplateService } from "@libs/services/email-template/src/email-template.service";
import { AdminAuthModule } from "../auth/auth.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";

@Module({
  imports: [EmailTemplatePersistenceModule, AdminAuthModule,UserPersistenceModule],
  providers: [EmailTemplateService, EmailTemplateResolver,EnvService],
  exports: [EmailTemplateService],
})
export class EmailTemplateModule {}