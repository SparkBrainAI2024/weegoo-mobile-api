import { DriverDocument } from "@libs/data-access/entities/driver-document.entity";
import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class Driver {
  @Field(() => String)
  id: string;

  @Field({ nullable: true })
  fullName?: string;

  @Field({ nullable: true })
  profileImage?: string;

  @Field()
  rating: number;

  @Field({ nullable: true })
  email?: string;

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

  @Field(() => Number, { nullable: true })
  totalRides?: number;

  @Field(() => Number, { nullable: true })
  totalEarnings?: number;

  @Field(() => [DriverDocument], { nullable: true })
  documents: DriverDocument[];
}
