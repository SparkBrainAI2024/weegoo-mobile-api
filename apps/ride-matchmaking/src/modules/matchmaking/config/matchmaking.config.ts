/**
 * Matchmaking configuration constants and defaults.
 * These can be overridden via environment variables.
 */

export const MATCHMAKING_CONFIG = {
  // ─── INSTANT Ride Config ───
  /** Initial search radius in km for instant */
  INITIAL_RADIUS_KM: 1,
  /** Expanding ring radii for instant rides (km) */
  FALLBACK_RADII_KM: [1, 2, 4, 7, 10],
  /** Maximum number of fallback attempts for instant */
  MAX_ATTEMPTS: 5,
  /** Driver wait time for first attempt (seconds) */
  FIRST_ATTEMPT_WAIT_SECONDS: 15,
  /** Driver wait time for subsequent attempts (seconds) */
  SUBSEQUENT_ATTEMPT_WAIT_SECONDS: 20,

  // ─── SCHEDULED Ride Config ───
  /** Expanding ring radii for scheduled rides (km) */
  SCHEDULED_FALLBACK_RADII_KM: [1, 3, 5, 10, 15],
  /** Driver wait time per ring for scheduled (seconds) — all 20s */
  SCHEDULED_ATTEMPT_WAIT_SECONDS: 20,

  // ─── Shared Config ───
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

  // ─── INSTANT Fare Config (additive) ───
  FARE: {
    BASE_PICKUP_COST: 1.0,
    PER_KM_RATE: 1.2,
    PER_MINUTE_RATE: 0.3,
  },
  /** Weather multipliers for instant fare by vehicle type */
  WEATHER_MULTIPLIERS: {
    CAR: { light: 1.05, moderate: 1.15, heavy: 1.25 },
    MOTORBIKE: { light: 1.05, moderate: 1.15, heavy: 1.35 },
    SCOOTER: { light: 1.05, moderate: 1.15, heavy: 1.35 },
  },
  /** Traffic multipliers for instant fare by vehicle type */
  TRAFFIC_MULTIPLIERS: {
    CAR: { low: 1.0, moderate: 1.15, heavy: 1.3, severe: 1.5 },
    MOTORBIKE: { low: 1.0, moderate: 1.1, heavy: 1.2, severe: 1.3 },
    SCOOTER: { low: 1.0, moderate: 1.1, heavy: 1.2, severe: 1.3 },
  },

  // ─── SCHEDULED Fare Config (multiplicative) ───
  SCHEDULED_FARE: {
    BASE_PICKUP_COST: 1.0,
    PER_KM_RATE: 1.2,
    PER_MINUTE_RATE: 0.3,
    /** Ride type multiplier */
    RIDE_TYPE_MULTIPLIER: { CAR: 1.0, MOTORBIKE: 0.7 },
    /** Rain multiplier based on forecast at scheduled time */
    RAIN_MULTIPLIER: { light: 1.1, heavy: 1.3 },
    /** Traffic multiplier based on historical traffic at scheduled time */
    SCHEDULED_TRAFFIC_MULTIPLIER: { moderate: 1.2, heavy: 1.4 },
  },

  /** User penalty limit (cancellations per month) */
  USER_CANCELLATION_LIMIT_PER_MONTH: 3,
};

export type WeatherCondition = 'none' | 'light' | 'moderate' | 'heavy';
export type TrafficCondition = 'low' | 'moderate' | 'heavy' | 'severe';
export type RainCondition = 'none' | 'light' | 'heavy';
export type HistoricalTraffic = 'low' | 'moderate' | 'heavy';

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
  /** Scheduled-specific */
  scheduledPickupTime?: Date;
  acceptableWaitWindowMinutes?: number;
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

export interface ScheduledFareBreakdown {
  baseFare: number;
  rideTypeMultiplier: number;
  rainMultiplier: number;
  trafficMultiplier: number;
  total: number;
}