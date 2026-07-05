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
  phone?: string;

  @Field(() => String, { nullable: true })
  locationChannelId?: string;

  @Field(() => String, { nullable: true })
  geoLocation?: string;

  @Field(() => [DriverDocument], { nullable: true })
  documents: DriverDocument[];
}
