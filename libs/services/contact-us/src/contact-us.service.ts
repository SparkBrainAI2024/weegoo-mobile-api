import { BadRequestException, Injectable } from '@nestjs/common';
import { ContactUsRepository } from '@libs/data-access/repositories/contact-us.repository';
import { MailService } from '@libs/services/mail';
import { CreateContactUsInput } from '@libs/data-access/dtos/input/create-contact-us.input';
import { CreateContactUsResponse } from '@libs/data-access/dtos/response/create-contact-us.response';
import { ContactUsStatus } from '@libs/data-access/enums/contact-us.enum';

@Injectable()
export class ContactUsService {
  constructor(
    private readonly contactUsRepo: ContactUsRepository,
    private readonly mailService: MailService,
  ) {}

  async createContactUs(
    userId: string,
    userRole: string,
    input: CreateContactUsInput,
  ): Promise<CreateContactUsResponse> {
    const { name, email, mobileNumber, message } = input;

    // Validate message length
    if (!message || message.trim().length < 10) {
      throw new BadRequestException('Message must be at least 10 characters.');
    }

    // Save to database with userId, userRole, and default ACTIVE status
    const contactUs = await this.contactUsRepo.create({
      name,
      email,
      mobileNumber,
      message: message.trim(),
      userId,
      userRole,
      status: ContactUsStatus.ACTIVE,
    });

    // Send email notification to admin
    try {
       this.mailService.sendContactUsEmail({
        name,
        email,
        mobileNumber,
        message: message.trim(),
      });
    } catch (e) {
      // Email failure should not block the contact us submission
      console.error('Failed to send contact us email:', e);
    }

    return {
      message: 'Your message has been sent successfully.',
      success: true,
      contactUs,
    };
  }
}