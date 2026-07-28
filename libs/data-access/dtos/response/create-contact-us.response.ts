import { Field, ObjectType } from '@nestjs/graphql';
import { ContactUs } from '../../entities/contact-us.entity';

@ObjectType()
export class CreateContactUsResponse {
  @Field(() => String)
  message: string;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => ContactUs, { nullable: true })
  contactUs?: ContactUs;
}