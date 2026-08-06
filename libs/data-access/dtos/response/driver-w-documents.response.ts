import { GenderEnum, UserStatus, Vehicle } from "@libs/data-access";
import { DriverDocument } from "@libs/data-access/entities/driver-document.entity";
import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DriverWDocuments {
  @Field(() => String)
  id: string;

  @Field(() => String)
  userId: string;

  @Field({ nullable: true })
  fullName?: string;

  @Field({ nullable: true })
  profileImage?: string;

  @Field({ nullable: true })
  rating?: number;

  @Field({ nullable: true })
  email?: string;

  @Field(() => GenderEnum)
  gender: GenderEnum;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  suspended?: boolean;

  @Field({ nullable: true })
  geoLocation?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  locationChannelId?: string;

  @Field(() => String, { nullable: true })
  dateOfBirth?: string;

  @Field(() => String)
  joinedDate: String;

  @Field(() => String, { nullable: true })
  downloadUrl?: string;

  @Field(() => Number, { nullable: true })
  totalRidesAsDriver?: number;

  @Field(() => Number, { nullable: true })
  totalEarnings?: number;

  @Field(() => Number, { nullable: true })
  amountDueToCompany?: number;

  @Field(() => String, { nullable: true })
  lastTripAt: string;

  @Field(() => String, { nullable: true })
  lastTripStartTime: string;

  @Field(() => String, { nullable: true })
  lastTripEndTime: string;

  @Field(() => Number, { nullable: true })
  lastTripDuration: number;

  @Field(() => UserStatus, { nullable: true })
  status?: UserStatus;

  @Field(() => String, { nullable: true })
  citizenshipNumber?: string;

  @Field(() => String, { nullable: true })
  emergencyContact?: string;

  @Field(() => [DriverDocument], { nullable: true })
  documents: DriverDocument[];

  @Field(() => Boolean, { nullable: true })
  allDocumentsApproved: boolean;

  @Field(() => Vehicle, { nullable: true })
  vehicle?: Vehicle;
}
