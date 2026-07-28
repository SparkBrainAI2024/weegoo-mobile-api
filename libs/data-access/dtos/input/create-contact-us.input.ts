import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

@InputType()
export class CreateContactUsInput {
  @Field(() => String)
  @IsString()
  name: string;

  @Field(() => String)
  @IsEmail()
  email: string;

  @Field(() => String)
  @Matches(/^\+977\d{10}$/, {
    message: 'Mobile number must start with +977 followed by 10 digits',
  })
  mobileNumber: string;

  @Field(() => String)
  @IsString()
  @MinLength(10, { message: 'Message must be at least 10 characters' })
  message: string;
}