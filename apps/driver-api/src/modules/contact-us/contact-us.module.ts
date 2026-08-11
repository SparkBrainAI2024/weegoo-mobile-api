import { Module } from '@nestjs/common';
import { ContactUsPersistenceModule } from '@libs/services/contact-us/src/contact-us-persistence.module';
import { ContactUsService } from '@libs/services/contact-us/src/contact-us.service';
import { ContactUsResolver } from '@libs/services/contact-us/src/resolver/contact-us.resolver';
import { MailService, SendGridMailModule } from '@libs/services/mail';
import { UserPersistenceModule } from '@libs/services/user/user-persistent.module';

@Module({
  imports: [ContactUsPersistenceModule, UserPersistenceModule, SendGridMailModule],
  providers: [ContactUsService, ContactUsResolver, MailService],
  exports: [ContactUsService],
})
export class ContactUsModule {}
