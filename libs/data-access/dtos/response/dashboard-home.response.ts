import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { Rides } from '../../entities/rides.entity';
import { DriverOnlineStatus, ridePreference } from '../../enums/user.enum';
import { DriverDocumentBundleStatus, DriverDocumentType } from '../../enums/driver-document.enum';

@ObjectType()
export class DocumentStatus {
  @Field(() => DriverDocumentType)
  type: DriverDocumentType;

  @Field(() => DriverDocumentBundleStatus)
  status: DriverDocumentBundleStatus;

  /**
   * Admin's note explaining why this document was rejected.
   *
   * Only surfaced on the driver home dashboard (`dashboardHomeApi`) and only
   * while the document bundle is REJECTED — it is null for every other status.
   */
  @Field(() => String, { nullable: true })
  rejectedReason?: string;
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

  @Field(() => Boolean, { nullable: true })
  vehicleStatus?: boolean;

  @Field(() => ridePreference, { nullable: true })
  ridePreference?: ridePreference;

  /** True when the driver has set weekly availability for the current week. */
  @Field(() => Boolean, { defaultValue: false })
  isWeekAvailability?: boolean;
}
