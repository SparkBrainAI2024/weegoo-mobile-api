export interface TriggerMatchmakingResult {
  success: boolean;
  message: string;
  matched: boolean;
  rideId: string;
  rideUUId: string;
  driverId?: string;
  driverName?: string;
  attempts?: any[];
  acceptedDetails?: any;
}
