import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { PageType } from '@libs/data-access/enums/page.enum';

@InputType()
export class CreatePageInput {
  @Field({ description: 'Title of the page; slug is auto-generated from this' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @Field(() => PageType)
  @IsEnum(PageType)
  type: PageType;

  @Field({ description: 'HTML or markdown content of the page' })
  @IsString()
  @MinLength(10)
  content: string;
}