import { NotificationType } from "@libs/data-access/enums/notification.enum";
import { GenderEnum } from "@libs/data-access/enums/user.enum";
import { RideUserInputSnapshot } from "@libs/data-access/common/ride-user-snapshot";
import { Field, InputType, Float } from "@nestjs/graphql";
import { IsEnum, IsOptional, IsString, IsNumber, IsArray, ValidateNested, IsMongoId, IsNotEmpty } from "class-validator";
import { Type } from "class-transformer";
import { RideStatus, RideTypes } from "@libs/data-access/enums/rides.enum";

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


  @Field(() => String, { nullable: true })
  @IsMongoId()
  @IsNotEmpty()
  rideId?: string;

  @Field(() => RideTypes, { nullable: true })
  @IsOptional()
  @IsEnum(RideTypes)
  rideType?: RideTypes;


  @Field(() => RideStatus, { nullable: true })
  @IsOptional()
  @IsEnum(RideStatus)
  rideStatus?: RideStatus;


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

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  passengerName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  passengerPhone?: string;

  @Field(() => GenderEnum, { nullable: true, defaultValue: GenderEnum.UNPUBLISHED })
  @IsOptional()
  @IsEnum(GenderEnum)
  passengerGender?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  passengerProfileImages?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  driverName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  driverPhone?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  driverProfileImage?: string;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  driverRating?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  vehicleModel?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  vehicleColor?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  vehicleNumberPlate?: string;

  @Field(() => RideUserInputSnapshot, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RideUserInputSnapshot)
  passengerSnapshot?: RideUserInputSnapshot;

  @Field(() => RideUserInputSnapshot, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RideUserInputSnapshot)
  driverSnapshot?: RideUserInputSnapshot;
}
