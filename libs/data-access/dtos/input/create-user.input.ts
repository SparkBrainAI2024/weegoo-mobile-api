import { Field, InputType } from "@nestjs/graphql";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsEmail,
  ValidateNested,
  MinLength,
  MaxLength,
  IsDate,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { GenderEnum, ridePreference, ProvinceEnum } from "@libs/data-access/enums/user.enum";
import { IsValidDate } from "@libs/common/decorators/validation/date-of-birth.decorator";
import { GeoLocationInput } from "./geo-location.input";

@InputType()
export class CreateUserDetailsInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @MinLength(3, { message: "USER.MIN_FULL_NAME" })
  @MaxLength(30, { message: "USER.MAX_FULL_NAME" })
  fullName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: "USER.INVALID_ADDRESS" })
  address?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: "USER.INVALID_PROFILE_IMAGE" })
  profileImage?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail({}, { message: "USER.INVALID_EMAIL" })
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : value))
  @IsDate({ message: "USER.INVALID_DOB" })
  @IsValidDate({ message: "USER.INVALID_DOB_RANGE" })
  dateOfBirth?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: "USER.INVALID_BIO" })
  bio?: string;

  @Field(() => GeoLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationInput)
  geoLocation?: GeoLocationInput;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEnum(GenderEnum, { message: "USER.INVALID_GENDER" })
  gender?: GenderEnum;

  @Field(() => ridePreference, { nullable: true })
  @IsOptional()
  @IsEnum(ridePreference, { message: "USER.INVALID_RIDE_PREFERENCE" })
  ridePreference?: ridePreference;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: "USER.INVALID_DISTRICT" })
  district?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: "USER.INVALID_STREET_NAME" })
  streetName?: string;

  @Field(() => ProvinceEnum, { nullable: true })
  @IsOptional()
  @IsEnum(ProvinceEnum, { message: "USER.INVALID_PROVINCE" })
  province?: ProvinceEnum;
}