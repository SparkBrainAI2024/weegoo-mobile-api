import { Module } from '@nestjs/common';
import { ContactUsPersistenceModule } from './contact-us-persistence.module';
import { ContactUsService } from './contact-us.service';
import { ContactUsResolver } from './resolver/contact-us.resolver';
import { MailService, SendGridMailModule } from '@libs/services/mail';
import { UserPersistenceModule } from '@libs/services/user/user-persistent.module';

@Module({
  imports: [ContactUsPersistenceModule, UserPersistenceModule, SendGridMailModule],
  providers: [ContactUsService, ContactUsResolver, MailService],
  exports: [ContactUsService],
})
export class ContactUsModule {}
