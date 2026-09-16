import { resolveBookedSlotIndex } from "./time-helper";

/**
 * The two INDEPENDENT seat pools a driver availability day keeps:
 *  - `OUTBOUND` → `availableSeats`         (the "to destination" trip)
 *  - `RETURN`   → `returnAvailableSeats`   (the "back home" trip)
 *
 * Booking a seat on one leg must never consume capacity of the other leg.
 */
export const SCHEDULED_SEAT_POOL = {
  OUTBOUND: "OUTBOUND",
  RETURN: "RETURN",
} as const;

export type ScheduledSeatPool =
  (typeof SCHEDULED_SEAT_POOL)[keyof typeof SCHEDULED_SEAT_POOL];

/**
 * Maps a seat pool to the availability-day field holding its remaining seats.
 * Used both for the pre-booking availability check and for the atomic `$inc`
 * that decrements the pool when a scheduled ride is booked.
 */
export const SCHEDULED_SEAT_FIELD: Record<ScheduledSeatPool, string> = {
  [SCHEDULED_SEAT_POOL.OUTBOUND]: "availableSeats",
  [SCHEDULED_SEAT_POOL.RETURN]: "returnAvailableSeats",
};

/**
 * Whether a booking for `bookingTime` falls on the RETURN time slot of the
 * driver's availability day.
 *
 * Availability rules (enforced in AvailabilityService):
 *  - one-way day   → exactly 1 slot  → slot index 0 is the only leg;
 *  - round-trip day → exactly 2 slots → index 0 = outbound, index 1 = return.
 *
 * Legacy days may carry more than 2 slots, so the LAST slot is treated as the
 * return leg (for the enforced 2-slot round trip that is index 1).
 *
 * @param isOneWay the availability day's `isOneWay` flag — a one-way day never
 *                 has a return leg, so it always resolves to `false`.
 */
export const isReturnTimeSlotBooking = (
  bookingTime: Date,
  timeSlots: Array<{ startTime?: string | null }> = [],
  isOneWay: boolean = false,
): boolean => {
  if (isOneWay) return false;
  const slots = timeSlots || [];
  // Fewer than 2 slots means there is no separate return leg to book.
  if (slots.length < 2) return false;
  const bookedSlotIndex = resolveBookedSlotIndex(bookingTime, slots);
  if (bookedSlotIndex < 0) return false;
  return bookedSlotIndex === slots.length - 1;
};

/**
 * Resolves the seat pool a scheduled booking draws its seats from.
 * The booking is allocated from `returnAvailableSeats` when it falls on the
 * return time slot, otherwise from the outbound `availableSeats`.
 */
export const resolveScheduledSeatPool = (
  bookingTime: Date,
  timeSlots: Array<{ startTime?: string | null }> = [],
  isOneWay: boolean = false,
): ScheduledSeatPool =>
  isReturnTimeSlotBooking(bookingTime, timeSlots, isOneWay)
    ? SCHEDULED_SEAT_POOL.RETURN
    : SCHEDULED_SEAT_POOL.OUTBOUND;