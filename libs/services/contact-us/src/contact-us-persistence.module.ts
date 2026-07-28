import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactUs, ContactUsSchema } from '@libs/data-access/entities/contact-us.entity';
import { ContactUsRepository } from '@libs/data-access/repositories/contact-us.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactUs.name, schema: ContactUsSchema },
    ]),
  ],
  providers: [ContactUsRepository],
  exports: [ContactUsRepository],
})
export class ContactUsPersistenceModule {}