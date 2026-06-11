import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PageType } from '@libs/data-access/enums/page.enum';

@InputType()
export class UpdatePageInput {
  @Field({ nullable: true, description: 'Title of the page; slug is regenerated if changed' })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => PageType, { nullable: true })
  @IsOptional()
  @IsEnum(PageType)
  type?: PageType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;
}