import { NotificationType } from "@libs/data-access/enums/notification.enum";
import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsOptional, IsString } from "class-validator";

@InputType()
export class CreateNotificationInput {
  @Field(() => String)
  @IsString()
  title: string;

  @Field(() => NotificationType)
  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}