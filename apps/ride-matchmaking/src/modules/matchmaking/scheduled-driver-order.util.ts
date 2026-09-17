/**
 * Ordering of the SCHEDULED (booking) driver list returned to a passenger by
 * `requestScheduledRide` / `matchScheduledDrivers`.
 *
 * Priority:
 *  1. TIME MATCHED — the driver whose MATCHED availability time slot starts
 *     closest to the requested booking time comes first, so an exact slot match
 *     (diff 0) always ranks top and the list degrades towards the furthest
 *     matched slot in either direction.
 *  2. LOCATION — drivers tied on the time difference are ordered by the nearest
 *     availability pickup location (`distanceToPickupKm` ascending).
 *
 * The "matched" slot is the SAME slot the seat pool is resolved from (nearest
 * future slot, else nearest past — see `resolveBookedSlotIndex` in
 * `@libs/common`), so the list order and the consumed seat pool never disagree.
 *
 * Pure module (no imports) so it can be unit-tested without pulling in the
 * NestJS/Mongoose dependency graph — same convention as `seat-calculator.util.ts`.
 */

/**
 * Sort key used when a driver has no resolvable matched slot start time.
 * Deliberately larger than any real difference so such drivers sort LAST.
 */
export const UNMATCHED_SLOT_DIFF_MS = Number.MAX_SAFE_INTEGER;

/**
 * Absolute difference (ms) between the requested booking time and the start of
 * the availability slot the booking matched.
 *
 * Returns `UNMATCHED_SLOT_DIFF_MS` when either value is missing/invalid, so an
 * unparsable slot can never win the "closest match" comparison.
 */
export function resolveSlotTimeDiffMs(
  bookingTime: Date | null | undefined,
  matchedSlotStart: Date | null | undefined,
): number {
  const bookingMs = bookingTime instanceof Date ? bookingTime.getTime() : NaN;
  const slotMs = matchedSlotStart instanceof Date ? matchedSlotStart.getTime() : NaN;
  if (Number.isNaN(bookingMs) || Number.isNaN(slotMs)) return UNMATCHED_SLOT_DIFF_MS;
  return Math.abs(slotMs - bookingMs);
}

/** Fields a candidate driver must expose to be ordered by this helper. */
export interface ScheduledDriverOrderKey {
  /** |matched slot start − requested booking time| in ms. */
  slotTimeDiffMs: number;
  /** Availability pickup → passenger pickup distance in km. */
  distanceToPickupKm: number;
}

/** Coerces a possibly-invalid time diff into a comparable number. */
const toSafeDiff = (value: number): number =>
  Number.isFinite(value) ? value : UNMATCHED_SLOT_DIFF_MS;

/** Coerces a possibly-invalid distance into a comparable number. */
const toSafeKm = (value: number): number =>
  Number.isFinite(value) ? value : UNMATCHED_SLOT_DIFF_MS;

/**
 * Comparator for the scheduled driver list: closest matched slot time first,
 * nearest pickup location second.
 */
export function compareScheduledDrivers(
  a: ScheduledDriverOrderKey,
  b: ScheduledDriverOrderKey,
): number {
  const byTime = toSafeDiff(a.slotTimeDiffMs) - toSafeDiff(b.slotTimeDiffMs);
  if (byTime !== 0) return byTime;
  return toSafeKm(a.distanceToPickupKm) - toSafeKm(b.distanceToPickupKm);
}

/**
 * Sorts the candidate list in place by matched time slot, then by location.
 * (Array#sort is stable, so drivers identical on both keys keep their original
 * relative order.)
 */
export function sortBySlotMatchThenLocation<T extends ScheduledDriverOrderKey>(
  drivers: T[],
): T[] {
  return drivers.sort(compareScheduledDrivers);
}
