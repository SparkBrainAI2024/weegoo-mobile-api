export interface MatchedDriverInterface {
  driverId: string;
  fullName?: string;
  phone?: string;
  profileImage?: string;
  rating?: number;
}

export interface MatchedVehicleInterface {
  vehicleId?: string;
  vehicleModel?: string;
  vehicleType?: string;
  color?: string;
  numberPlate?: string;
  year?: number;
}

export interface MatchedPassengerInterface {
  passengerId?: string;
  fullName?: string;
  phone?: string;
  profileImage?: string;
  gender?: string;
}

export interface LocationInterface {
  address?: string;
  coordinates?: number[];
  city?: string;
}

export interface FareBreakdownInterface {
  baseFare?: number;
  pickupCost?: number;
  distanceCost?: number;
  durationCost?: number;
  total?: number;
}

export interface AcceptedDetailsInterface {
  rideId: string;
  rideUUId: string;
  driver?: MatchedDriverInterface;
  vehicle?: MatchedVehicleInterface;
  passenger?: MatchedPassengerInterface;
  pickupLocation?: LocationInterface;
  dropoffLocation?: LocationInterface;
  estimatedFare?: number;
  estimatedTimeInMinutes?: number;
  distanceInKm?: number;
  acceptedAt?: string;
  bookingTime?: string;
  noOfPassengers?: number;
  availability?: ScheduledAvailabilityInterface | null;
  ablyChannelId?: string;
  driverLocationChannel?: string;
}

export interface ScheduledAvailabilityInterface {
  day?: string;
  date?: string;
  vehicleType?: string;
  isAvailableForBookings?: boolean;
  availableSeats?: number;
  timeSlots?: string[];
  pickupLocation?: { address?: string; latitude?: number | null; longitude?: number | null };
  dropOffLocation?: { address?: string; latitude?: number | null; longitude?: number | null };
  matchesTimeSlot?: boolean;
  /** Completed trips of the available driver on this availability day. */
  totalTrips?: number;
  /** Additional notes from the driver for the day. */
  notes?: string | null;
  /** Major stops along the driver's route for the day. */
  majorStops?: string[];
}

/** One available scheduled ride option returned by the booking listing flow. */
export interface AvailableScheduledDriverInterface {
  driverId?: string;
  driverName?: string;
  driverImage?: string | null;
  driverEmail?: string | null;
  phone?: string;
  rating?: number;
  vehicleImage?: string | null;
  vehicleId?: string;
  vehicleName?: string | null;
  vehicleType?: string;
  vehicleModel?: string;
  /** Manufacturing year of the vehicle. */
  year?: number | null;
  isAcType?: boolean | null;
  color?: string;
  numberPlate?: string;
  distanceToPickupKm?: number;
  estimatedTimeToReachMinutes?: number;
  availability?: ScheduledAvailabilityInterface | null;
}

export interface TriggerMatchmakingResult {
  success: boolean;
  message: string;
  matched: boolean;
  rideId: string;
  rideUUId: string;
  passengerId?: string;
  driverId?: string;
  driverName?: string;
  driverImage?: string;
  rating?: number;
  rideType?: string;
  rideStatus?: string;
  attempts?: any[];
  estimatedFare?: FareBreakdownInterface;
  estimatedFareTotal?: number;
  estimatedTimeInMinutes?: number;
  distanceInKm?: number;
  noOfPassengers?: number;
  ablyChannelId?: string;
  driverLocationChannel?: string;
  pickupLocation?: LocationInterface;
  dropoffLocation?: LocationInterface;
  acceptedDetails?: AcceptedDetailsInterface;
  availableDrivers?: AvailableScheduledDriverInterface[];
}
