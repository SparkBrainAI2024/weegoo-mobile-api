/**
 * Matchmaking configuration constants and defaults.
 * These can be overridden via environment variables.
 */

export const MATCHMAKING_CONFIG = {
  /** Initial search radius in km */
  INITIAL_RADIUS_KM: 1,

  /** Expanding ring radii for each attempt (km) */
  FALLBACK_RADII_KM: [1, 2, 4, 7, 10],

  /** Maximum number of fallback attempts */
  MAX_ATTEMPTS: 5,

  /** Driver wait time for first attempt (seconds) */
  FIRST_ATTEMPT_WAIT_SECONDS: 15,

  /** Driver wait time for subsequent attempts (seconds) */
  SUBSEQUENT_ATTEMPT_WAIT_SECONDS: 20,

  /** Maximum drivers to consider per ring */
  MAX_DRIVERS_PER_RING: 50,

  /** Number of drivers to send ride request to per attempt */
  REQUEST_BATCH_SIZE: 5,

  /** Minimum driver accept rating (configurable) */
  MIN_ACCEPT_RATING: 4.0,

  /** After how many attempts to bypass rating filter */
  BYPASS_RATING_AFTER_ATTEMPTS: 2,

  /** Scoring weights */
  SCORING: {
    DISTANCE_WEIGHT: 0.6,
    RATING_WEIGHT: -0.3,
    COMPLETED_TRIPS_WEIGHT: 0.1,
  },

  /** Fare calculation defaults */
  FARE: {
    BASE_PICKUP_COST: 1.0,
    PER_KM_RATE: 1.2,
    PER_MINUTE_RATE: 0.3,
  },

  /** Weather multipliers by vehicle type */
  WEATHER_MULTIPLIERS: {
    CAR: { light: 1.05, moderate: 1.15, heavy: 1.25 },
    MOTORBIKE: { light: 1.05, moderate: 1.15, heavy: 1.35 },
    SCOOTER: { light: 1.05, moderate: 1.15, heavy: 1.35 },
  },

  /** Traffic multipliers by vehicle type */
  TRAFFIC_MULTIPLIERS: {
    CAR: { low: 1.0, moderate: 1.15, heavy: 1.3, severe: 1.5 },
    MOTORBIKE: { low: 1.0, moderate: 1.1, heavy: 1.2, severe: 1.3 },
    SCOOTER: { low: 1.0, moderate: 1.1, heavy: 1.2, severe: 1.3 },
  },

  /** User penalty limit (cancellations per month) */
  USER_CANCELLATION_LIMIT_PER_MONTH: 3,
};

export type WeatherCondition = 'none' | 'light' | 'moderate' | 'heavy';
export type TrafficCondition = 'low' | 'moderate' | 'heavy' | 'severe';

export interface MatchRequest {
  rideId: string;
  rideUUId: string;
  rideType: 'INSTANT' | 'SCHEDULED';
  passengerId: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  distanceInKm?: number;
  estimatedDurationMinutes?: number;
  weather?: WeatherCondition;
  traffic?: TrafficCondition;
}

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
  subtotal: number;
  weatherSurcharge: number;
  weatherSurchargePercent: number;
  trafficSurcharge: number;
  trafficSurchargePercent: number;
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