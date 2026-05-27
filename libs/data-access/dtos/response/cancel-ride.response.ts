import { RideStatus } from '@libs/data-access/enums/rides.enum';
import { roles } from '@libs/data-access/enums/user.enum';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class CancelRideResponse {
  @Field(() => ID)
  _id: string;

  @Field(()=>RideStatus)
  rideStatus: RideStatus;

  @Field(()=>Date)
  cancelledAt: Date;

  @Field(() => roles, { nullable: true })
cancelledByRole: roles;

  @Field(() => ID)
  cancelledBy: string;


  @Field(() => String)
  cancelSubCategoryLabel: string;

  @Field(() => ID)
  cancelSubCategoryId: string;

  @Field({ nullable: true })
  cancelReasonContent?: string;
}