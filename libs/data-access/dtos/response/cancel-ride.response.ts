

import { ObjectType, Field, ID } from '@nestjs/graphql';
import { roles } from '@libs/data-access/enums/user.enum';
import { RideStatus } from '@libs/data-access/enums/rides.enum';
import { CategoryAccessedByRole } from '@libs/data-access/enums/issue.enum';

@ObjectType()
export class CancellationDetail {
  @Field(() => Date)
  cancelledAt: Date;

  @Field(() => ID)
  cancelledBy: string;

  @Field(() => CategoryAccessedByRole)
  cancelledByRole: CategoryAccessedByRole;

  @Field(() => ID)
  cancelSubCategoryId: string;

  @Field(() => String)
  cancelSubCategoryLabel: string;

  @Field(() => String, { nullable: true })
  cancelReasonContent?: string;
}

@ObjectType()
export class CancelRideResponse {
  @Field(() => ID)
  _id: string;

  @Field(() => RideStatus)
  rideStatus: RideStatus;

  @Field(() => CancellationDetail, { nullable: true })
  cancellationDetail: CancellationDetail;
}