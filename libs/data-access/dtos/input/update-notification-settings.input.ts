import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateNotificationSettingsInput {
  @Field(() => String)
  @IsString()
  role: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  earnings?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  appUpdates?: boolean;
}