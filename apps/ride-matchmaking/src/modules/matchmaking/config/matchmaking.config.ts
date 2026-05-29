/**
 * Matchmaking configuration constants and defaults.
 */

export const MATCHMAKING_CONFIG = {
  // ─── INSTANT Ride Config ───
  INITIAL_RADIUS_KM: 1,
  FALLBACK_RADII_KM: [1, 2, 4, 7, 10],
  MAX_ATTEMPTS: 5,
  FIRST_ATTEMPT_WAIT_SECONDS: 15,
  SUBSEQUENT_ATTEMPT_WAIT_SECONDS: 20,

  // ─── SCHEDULED Ride Config ───
  SCHEDULED_FALLBACK_RADII_KM: [1, 3, 5, 10, 15],
  SCHEDULED_ATTEMPT_WAIT_SECONDS: 20,

  // ─── Shared Config ───
  MAX_DRIVERS_PER_RING: 50,
  REQUEST_BATCH_SIZE: 5,
  MIN_ACCEPT_RATING: 4.0,
  BYPASS_RATING_AFTER_ATTEMPTS: 2,

  SCORING: {
    DISTANCE_WEIGHT: 0.6,
    RATING_WEIGHT: -0.3,
    COMPLETED_TRIPS_WEIGHT: 0.1,
  },

  // ─── INSTANT Fare Config ───
  FARE: {
    BASE_PICKUP_COST: 1.0,
    PER_KM_RATE: 1.2,
    PER_MINUTE_RATE: 0.3,
  },

  // ─── SCHEDULED Fare Config (multiplicative) ───
  SCHEDULED_FARE: {
    PER_KM_RATE: 1.2,
    PER_MINUTE_RATE: 0.3,
    RIDE_TYPE_MULTIPLIER: { CAR: 1.0, MOTORBIKE: 0.7 },
    RAIN_MULTIPLIER: { light: 1.1, heavy: 1.3 },
    SCHEDULED_TRAFFIC_MULTIPLIER: { moderate: 1.2, heavy: 1.4 },
  },

  USER_CANCELLATION_LIMIT_PER_MONTH: 3,
};

export type RainCondition = 'none' | 'light' | 'heavy';
export type HistoricalTraffic = 'low' | 'moderate' | 'heavy';

export interface DriverScore {
  driverId: string;
  fullName: string;
  phone: string;
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
}

export interface MatchResult {
  matched: boolean;
  rideId: string;
  rideUUId: string;
  passengerId: string;
  driverId?: string;
  driverName?: string;
  estimatedFare?: FareBreakdown;
  attempts: MatchAttemptResult[];
  message: string;
}

export interface ScheduledFareBreakdown {
  baseFare: number;
  rideTypeMultiplier: number;
  rainMultiplier: number;
  trafficMultiplier: number;
  total: number;
}