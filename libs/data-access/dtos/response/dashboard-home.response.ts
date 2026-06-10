import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { Rides } from '../../entities/rides.entity';
import { DriverOnlineStatus } from '../../enums/user.enum';
import { DriverDocumentBundleStatus } from '../../enums/driver-document.enum';

@ObjectType()
export class DocumentStatus {
  @Field(() => String)
  type: string;

  @Field(() => DriverDocumentBundleStatus)
  status: DriverDocumentBundleStatus;
}

@ObjectType()
export class VerificationInfo {
  @Field(() => Boolean)
  verificationRequired: boolean;

  @Field(() => [DocumentStatus])
  documentStatuses: DocumentStatus[];
}

@ObjectType()
export class DashboardStats {
  @Field(() => Float, { nullable: true })
  totalEarnings?: number;

  @Field(() => Int, { nullable: true })
  totalTrips?: number;

  @Field(() => Float, { nullable: true })
  rating?: number;

  @Field(() => String, { nullable: true })
  onlineHoursToday?: string;
}

@ObjectType()
export class DashboardHomeResponse {
  @Field(() => [Rides])
  rides: Rides[];

  @Field(() => VerificationInfo, { nullable: true })
  verification?: VerificationInfo;

  @Field(() => DashboardStats, { nullable: true })
  stats?: DashboardStats;

  @Field(() => DriverOnlineStatus, { nullable: true })
  onlineStatus?: DriverOnlineStatus;
}