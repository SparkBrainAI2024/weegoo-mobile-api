import { GenderEnum, ridePreference, ProvinceEnum } from "@libs/data-access/enums/user.enum";
import { GraphQLJSON } from "graphql-scalars";
import { Field, ObjectType } from "@nestjs/graphql";
import { SavedLocation } from "../../common/saved-location";

@ObjectType()
export class WalletInfoResponse {
  @Field({ nullable: true })
  balance?: number;
}

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
  phoneNumber?: string;

  @Field({ nullable: true, defaultValue: false })
  emailVerified?: boolean;

  @Field(() => WalletInfoResponse, { nullable: true })
  walletInfo?: WalletInfoResponse;

  @Field({ nullable: true })
  totalTrips?: number;

  @Field({ nullable: true })
  amountDueToCompany?: number;

  @Field({ nullable: true })
  rating?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  notificationSettings?: Record<string, Record<string, boolean>>;

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

  @Field(() => SavedLocation, { nullable: true })
  homeLocation?: SavedLocation;

  @Field(() => SavedLocation, { nullable: true })
  workLocation?: SavedLocation;
}
