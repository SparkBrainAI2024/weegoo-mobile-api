import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional } from 'class-validator';

@InputType()
export class UpdateNotificationSettingsInput {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  earnings?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  appUpdates?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  offersAndPromotion?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  ridesUpdate?: boolean;
}