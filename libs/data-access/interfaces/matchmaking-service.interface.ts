export type RainCondition = 'none' | 'light' | 'heavy';
export type HistoricalTraffic = 'low' | 'moderate' | 'heavy';

export interface DriverScore {
  driverId: string;
  fullName: string;
  phone: string;
  email?: string;
  profileImage?: string;
  vehicleId: string;
  /** Vehicle commercial name (e.g. "Hiace", "Quick Rider"). */
  vehicleName?: string;
  vehicleModel: string;
  vehicleType: string;
  color: string;
  numberPlate: string;
  /** AC mode of the vehicle. */
  isAcType?: boolean;
  /** Fuel/mode of the vehicle: EV or PETROL. */
  vehicleModelType?: string | null;
  distanceToPickupKm: number;
  rating: number;
  completedTripsCount: number;
  score: number;
  estimatedTimeToReachMinutes: number;
  /**
   * Resolved availability of the driver for the requested scheduled day/time.
   * Populated only for SCHEDULED rides in findAvailableScheduledDrivers.
   */
  scheduledAvailability?: {
    day: string;
    date: string;
    vehicleType: string;
    /** Fare amount configured on the availability day (system or driver-set). */
    amount: number;
    isAvailableForBookings: boolean;
    availableSeats: number;
    remainingSeats?: number;
    timeSlots: string[];
    pickupLocation?: { address: string; latitude?: number | null; longitude?: number | null } | null;
    dropOffLocation?: { address: string; latitude?: number | null; longitude?: number | null } | null;
    matchesTimeSlot: boolean;
  };
}

export interface FareBreakdown {
  pickupCost: number;
  distanceCost: number;
  durationCost: number;
  total: number;
  baseFare:number;
}

export interface MatchAttemptResult {
  attemptNumber: number;
  radiusKm: number;
  waitTimeSeconds: number;
  driversFound: number;
  driversRequested: number;
  driverAccepted: boolean;
  acceptedDriverId?: string;
  timeoutExpired: boolean;
  status: 'no_drivers_found' | 'waiting_for_response' | 'accepted' | 'timeout';
}

export interface MatchResult {
  matched: boolean;
  rideId: string;
  rideUUId: string;
  passengerId: string;
  driverId?: string;
  driverName?: string;
  driverImage?: string;
  rating?: number;
  estimatedFare?: FareBreakdown;
  attempts: MatchAttemptResult[];
  message: string;
  ablyChannelId?: string;
  acceptedDetails?: {
    rideId: string;
    rideUUId: string;
    driver: { driverId: string; fullName: string; phone: string; profileImage?: string; rating: number };
    vehicle: { vehicleId: string; vehicleModel: string; vehicleType: string; color: string; numberPlate: string; year?: number };
    passenger: { passengerId: string; fullName: string; phone: string; profileImage?: string };
    pickupLocation: { address: string; coordinates: number[]; city?: string };
    dropoffLocation?: { address: string; coordinates: number[]; city?: string };
    estimatedFare: number;
    estimatedTimeInMinutes: number;
    distanceInKm: number;
    acceptedAt?: string;
  };
}

export interface ScheduledFareBreakdown {
  baseFare: number;
  total: number;
   pickupCost: number;
  distanceCost: number;
  durationCost: number;
}