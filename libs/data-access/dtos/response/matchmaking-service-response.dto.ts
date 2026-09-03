import { Field, ObjectType, Float, Int, ID } from '@nestjs/graphql';



@ObjectType()

export class FareBreakdownGraphQL {

  @Field(() => Float)

  pickupCost: number;



  @Field(() => Float)

  distanceCost: number;



  @Field(() => Float)

  durationCost: number;



  @Field(() => Float)

  total: number;

}



@ObjectType()

export class ScheduledFareBreakdownGraphQL {

  @Field(() => Float)

  baseFare: number;



  @Field(() => Float)

  total: number;

}



@ObjectType()

export class MatchAttemptResultGraphQL {

  @Field(() => Int)

  attemptNumber: number;



  @Field(() => Float)

  radiusKm: number;



  @Field(() => Int)

  waitTimeSeconds: number;



  @Field(() => Int)

  driversFound: number;



  @Field(() => Int)

  driversRequested: number;



  @Field(() => Boolean)

  driverAccepted: boolean;



  @Field(() => String, { nullable: true })

  acceptedDriverId?: string;



  @Field(() => Boolean)

  timeoutExpired: boolean;



  @Field(() => String)

  status: string;

}



@ObjectType()

export class PickupLocationGraphQL {

  @Field(() => String)

  address: string;



  @Field(() => [Float])

  coordinates: number[];



  @Field(() => String, { nullable: true })

  city?: string;

}



@ObjectType()

export class ScheduledAvailabilityLocationGraphQL {

  @Field(() => String, { nullable: true })

  address?: string;



  @Field(() => Float, { nullable: true })

  latitude?: number | null;



  @Field(() => Float, { nullable: true })

  longitude?: number | null;

}



@ObjectType()

export class ScheduledDriverAvailabilityGraphQL {

  @Field(() => String)

  day: string;



  @Field(() => String)

  date: string;



  @Field(() => String)

  vehicleType: string;



  @Field(() => Float)

  amount: number;



  @Field(() => Boolean)

  isAvailableForBookings: boolean;



  @Field(() => Int)

  availableSeats: number;



  @Field(() => Int, { nullable: true })

  remainingSeats?: number;



  @Field(() => [String])

  timeSlots: string[];



  @Field(() => ScheduledAvailabilityLocationGraphQL, { nullable: true })

  pickupLocation?: ScheduledAvailabilityLocationGraphQL | null;



  @Field(() => ScheduledAvailabilityLocationGraphQL, { nullable: true })

  dropOffLocation?: ScheduledAvailabilityLocationGraphQL | null;



  @Field(() => Boolean)

  matchesTimeSlot: boolean;

  @Field(() => Int)

  /** Completed trips of the available driver on this availability day. */

  totalTrips?: number;

  /** Additional notes from the driver for the requested day. */
  @Field(() => String, { nullable: true })
  notes?: string | null;

  /** Major stops along the driver/s route for the requested day. */
  @Field(() => [String], { nullable: true })
  majorStops?: string[];

}



@ObjectType()

export class DropoffLocationGraphQL {

  @Field(() => String)

  address: string;



  @Field(() => [Float])

  coordinates: number[];



  @Field(() => String, { nullable: true })

  city?: string;

}



@ObjectType()

export class DriverAcceptedDetailsGraphQL {

  @Field(() => String)

  rideId: string;



  @Field(() => String)

  rideUUId: string;



  @Field(() => String)

  driverId: string;



  @Field(() => String, { nullable: true })

  driverName?: string;



  @Field(() => String, { nullable: true })

  driverImage?: string;



  @Field(() => String, { nullable: true })
  vehicleImage?: string | null;

  @Field(() => Float, { nullable: true })

  rating?: number;

  @Field(() => String, { nullable: true })
  phone?: string;



  @Field(() => String, { nullable: true })

  vehicleType?: string;



  @Field(() => String, { nullable: true })

  vehicleModel?: string;



  @Field(() => String, { nullable: true })

  color?: string;



  @Field(() => String, { nullable: true })

  numberPlate?: string;



  @Field(() => Float, { nullable: true })

  estimatedFare?: number;



  @Field(() => Float, { nullable: true })

  estimatedTimeInMinutes?: number;



  @Field(() => Float, { nullable: true })

  distanceInKm?: number;



  @Field(() => PickupLocationGraphQL, { nullable: true })

  pickupLocation?: PickupLocationGraphQL;



  @Field(() => DropoffLocationGraphQL, { nullable: true })

  dropoffLocation?: DropoffLocationGraphQL;



  @Field(() => String, { nullable: true })

  ablyChannelId?: string;



  @Field(() => String, { nullable: true })

  acceptedAt?: string;



  @Field(() => String, { nullable: true })

  bookingTime?: string;



  @Field(() => Int, { nullable: true })

  noOfPassengers?: number;



  @Field(() => ScheduledDriverAvailabilityGraphQL, { nullable: true })

  availability?: ScheduledDriverAvailabilityGraphQL | null;

}



@ObjectType()

export class MatchResultGraphQL {

  @Field(() => Boolean)

  matched: boolean;



  @Field(() => String)

  rideId: string;



  @Field(() => String)

  rideUUId: string;



  @Field(() => String)

  passengerId: string;



  @Field(() => String, { nullable: true })

  driverId?: string;



  @Field(() => String, { nullable: true })

  driverName?: string;



  @Field(() => String, { nullable: true })

  driverImage?: string;



  @Field(() => Float, { nullable: true })

  rating?: number;



  @Field(() => FareBreakdownGraphQL, { nullable: true })

  estimatedFare?: FareBreakdownGraphQL;



  @Field(() => [MatchAttemptResultGraphQL])

  attempts: MatchAttemptResultGraphQL[];



  @Field(() => String)

  message: string;



  @Field(() => String, { nullable: true })

  ablyChannelId?: string;



  @Field(() => DriverAcceptedDetailsGraphQL, { nullable: true })

  acceptedDetails?: DriverAcceptedDetailsGraphQL;

}



/**

 * One available scheduled ride option returned by the booking listing flow.

 * Carries the driver info, the vehicle info, and the driver's availability info

 * for the requested day.

 */

@ObjectType()

export class ScheduledAvailableDriverGraphQL {

  @Field(() => String)

  driverId: string;



  @Field(() => String)

  driverName: string;



  @Field(() => String, { nullable: true })

  driverImage?: string | null;



  @Field(() => String, { nullable: true })

  driverEmail?: string | null;


  @Field(() => String, { nullable: true })

  vehicleImage?: string | null;


  @Field(() => String, { nullable: true })

  phone?: string;



  @Field(() => Float, { nullable: true })

  rating?: number;



  /** Amount configured on the driver's availability day for the requested day. */

  @Field(() => Float, { nullable: true })

  amount?: number;



  // Vehicle information

  @Field(() => String, { nullable: true })

  vehicleType?: string;


/** Vehicle document id. */

  @Field(() => ID, { nullable: true })

  vehicleId?: string | null;

  @Field(() => String, { nullable: true })

  vehicleModel?: string;



  /** Manufacturing year of the vehicle. */

  @Field(() => Int, { nullable: true })

  year?: number | null;



  @Field(() => String, { nullable: true })

  color?: string;



  @Field(() => String, { nullable: true })

  numberPlate?: string;



  /** Vehicle commercial name (e.g. "Hiace"). */

  @Field(() => String, { nullable: true })

  vehicleName?: string | null;



  /** AC mode of the vehicle. */

  @Field(() => Boolean, { nullable: true })

  isAcType?: boolean | null;



  // Availability information of the driver on the requested day

  @Field(() => ScheduledDriverAvailabilityGraphQL, { nullable: true })

  availability?: ScheduledDriverAvailabilityGraphQL | null;



  /** Estimated fare = the amount configured on the driver's availability day. */

  @Field(() => Float, { nullable: true })

  estimatedFare?: number;

}



@ObjectType()

export class ScheduledMatchResultGraphQL {

  @Field(() => Boolean)

  matched: boolean;



  @Field(() => String)

  rideId: string;



  @Field(() => String)

  rideUUId: string;



  @Field(() => String)

  passengerId: string;



  @Field(() => String)

  message: string;



  @Field(() => String, { nullable: true })

  ablyChannelId?: string;



  @Field(() => String, { nullable: true })

  rideStatus?: string;

  @Field(() => [ScheduledAvailableDriverGraphQL], { nullable: true })

  availableDrivers?: ScheduledAvailableDriverGraphQL[];

}



@ObjectType()

export class DriverResponseResultGraphQL {

  @Field(() => Boolean)

  success: boolean;



  @Field(() => String)

  message: string;



  @Field(() => String, { nullable: true })

  ablyChannelId?: string;



  @Field(() => DriverAcceptedDetailsGraphQL, { nullable: true })

  acceptedDetails?: DriverAcceptedDetailsGraphQL;

}



@ObjectType()

export class LocationUpdateResultGraphQL {

  @Field(() => Boolean)

  success: boolean;



  @Field(() => String)

  message: string;



  @Field(() => Float)

  latitude: number;



  @Field(() => Float)

  longitude: number;



  @Field(() => String)

  updatedAt: string;

}



@ObjectType()

export class VehicleEstimateGraphQL {

  @Field(() => String)

  vehicleType: string;



  @Field(() => Float)

  estimatedFare: number;



  @Field(() => Float, { nullable: true })

  originalFare?: number;



  @Field(() => Float, { nullable: true })

  discountAmount?: number;



  @Field(() => String, { nullable: true })

  promoCodeName?: string;



  @Field(() => ID, { nullable: true })

  promoCodeId?: string;



  @Field(() => Float)

  distanceKm: number;



  @Field(() => Float, { nullable: true })

  driverDistanceToPickupKm?: number;



  @Field(() => Float)

  estimatedTimeInMinutes: number;



  @Field(() => String)

  comfortType: string;



  @Field(() => Boolean, { nullable: true })

  hasAC?: boolean;



  @Field(() => Int)

  noOfPassengers: number;



  @Field(() => String, { nullable: true })

  promoCodeMessage?: string;

}


