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
  ablyChannelId?: string;
  driverLocationChannel?: string;
}

export interface TriggerMatchmakingResult {
  success: boolean;
  message: string;
  matched: boolean;
  rideId: string;
  rideUUId: string;
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
}
