import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ContactUs } from '@libs/data-access/entities/contact-us.entity';
import { ContactUsService } from '../contact-us.service';
import { CreateContactUsInput } from '@libs/data-access/dtos/input/create-contact-us.input';
import { CreateContactUsResponse } from '@libs/data-access/dtos/response/create-contact-us.response';
import { User, roles } from '@libs/data-access';
import { CurrentUser } from '@libs/common';
import { AuthGuard } from '@libs/guards';

@Resolver(() => ContactUs)
export class ContactUsResolver {
  constructor(private readonly contactUsService: ContactUsService) {}

  @UseGuards(AuthGuard)
  @Mutation(() => CreateContactUsResponse)
  async createContactUs(
    @CurrentUser() user: User,
    @Args('input') input: CreateContactUsInput,
  ): Promise<CreateContactUsResponse> {
    // Determine user role string from roles array
    const userRole = user.roles.includes(roles.RIDER) ? roles.RIDER : roles.USER;

    return this.contactUsService.createContactUs(
      user._id.toString(),
      userRole,
      input,
    );
  }
}