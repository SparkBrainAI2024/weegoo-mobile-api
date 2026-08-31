/**
 * Pure helpers for shared-seat (carpool) capacity accounting on SCHEDULED rides.
 *
 * SCHEDULED rides are a "booking" flow: a driver advertises a route/day with a
 * seat capacity, and MULTIPLE passengers can be matched to the same driver until
 * that capacity is maxed out. These helpers compute how many seats are still
 * available for booking given the passengers already confirmed on a driver-day,
 * WITHOUT depending on the heavy NestJS/Mongoose dependency graph so they can
 * be unit-tested in isolation.
 */

/** Fallback capacity used when a vehicle's capacity cannot be resolved. */
export const DEFAULT_SEAT_CAPACITY = 1;

/**
 * Resolve a day's *effective* seat capacity.
 *  - If the driver configured an explicit `availableSeats` (> 0), use it.
 *  - Otherwise fall back to the default capacity for the scheduled vehicle type.
 *  - If neither is available, fall back to a minimal capacity of 1.
 */
export function getEffectiveSeatCapacity(
  configuredSeats: number | null | undefined,
  vehicleTypeCapacity: number | null | undefined,
): number {
  const configured = Math.floor(Number(configuredSeats) || 0);
  if (configured > 0) return configured;
  const fallback = Math.floor(Number(vehicleTypeCapacity) || 0);
  return fallback > 0 ? fallback : DEFAULT_SEAT_CAPACITY;
}

/**
 * Seats still available for booking on a driver-day after subtracting the
 * passengers already CONFIRMED on it. Never goes below 0.
 */
export function getRemainingSeats(
  effectiveSeatCapacity: number,
  bookedSeats: number,
): number {
  const capacity = Math.floor(Number(effectiveSeatCapacity) || 0);
  const booked = Math.floor(Number(bookedSeats) || 0);
  const remaining = capacity - booked;
  return remaining < 0 ? 0 : remaining;
}

/** * Whether a passenger party of `noOfPassengers` can still be accommodated on a
 * driver-day given the seats already booked.**/
export function canAccommodateParty(effectiveSeatCapacity: number,
  bookedSeats: number,
  noOfPassengers: number,
): boolean {
  const passengers = Math.floor(Number(noOfPassengers) || 0);
  if (passengers < 1) return false;
  return getRemainingSeats(effectiveSeatCapacity, bookedSeats) >= passengers;
}
