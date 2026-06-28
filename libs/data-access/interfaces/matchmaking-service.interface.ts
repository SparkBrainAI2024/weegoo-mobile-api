export type RainCondition = 'none' | 'light' | 'heavy';
export type HistoricalTraffic = 'low' | 'moderate' | 'heavy';

export interface DriverScore {
  driverId: string;
  fullName: string;
  phone: string;
  profileImage?: string;
  vehicleId: string;
  vehicleModel: string;
  vehicleType: string;
  color: string;
  numberPlate: string;
  distanceToPickupKm: number;
  rating: number;
  completedTripsCount: number;
  score: number;
  estimatedTimeToReachMinutes: number;
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