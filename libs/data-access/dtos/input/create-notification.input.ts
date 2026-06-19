import { NotificationType } from "@libs/data-access/enums/notification.enum";
import { Field, InputType, Float } from "@nestjs/graphql";
import { IsEnum, IsOptional, IsString, IsNumber, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

@InputType()
class NotificationLocationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

  @Field(() => [Float], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates?: number[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  city?: string;
}

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

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  ablyChannelId?: string;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  waitTimeSeconds?: Number;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  estimatedFare?: Number;

  @Field(() => NotificationLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationLocationInput)
  pickupLocation?: NotificationLocationInput;

  @Field(() => NotificationLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationLocationInput)
  dropoffLocation?: NotificationLocationInput | null;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  distanceInKm?: number;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  estimatedTimeInMinutes?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  passengerId?: string;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  driverScore?: number;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  distanceToPickupKm?: number;
}
