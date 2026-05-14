import { GenderEnum, ridePreference, ProvinceEnum } from "@libs/data-access/enums/user.enum";
import { Field, ObjectType } from "@nestjs/graphql";
@ObjectType()
export class UserDetailsResponse {
  @Field({ nullable: true })
  _id?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  fullName?: string;

  @Field(() => GenderEnum, { nullable: true })
  gender?: GenderEnum;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  profileImage?: string;

  @Field({ nullable: true })
  dateOfBirth?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field(() => ridePreference, { nullable: true })
  ridePreference?: ridePreference;

  @Field({ nullable: true })
  district?: string;

  @Field({ nullable: true })
  streetName?: string;

  @Field(() => ProvinceEnum, { nullable: true })
  province?: ProvinceEnum;

  @Field({ nullable: true })
  createdAt?: string;
}