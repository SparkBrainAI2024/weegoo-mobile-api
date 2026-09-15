export const isTenMinutesLater = (updatedAt: Date) => {
  const currentTime = new Date();
  const tenMinutesLater = new Date(updatedAt.getTime() + 10 * 60 * 1000);
  return currentTime >= tenMinutesLater;
};
export const getDatePeriods = (startDate, endDate) => {
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const finalStartDate = new Date(startDate);
  const finalEndDate = new Date(endDate);

  const duration = Math.round((finalEndDate.getTime() - finalStartDate.getTime()) / ONE_DAY) + 1;
  console.log('Duration:', duration);
  const previousEndDate = new Date(finalStartDate);
  previousEndDate.setDate(previousEndDate.getDate() - 1);

  const previousStartDate = new Date(previousEndDate);
  previousStartDate.setDate(previousStartDate.getDate() - (duration - 1));

  return {
    duration,
    previousStartDate,
    previousEndDate,
  };
};

export const getPreviousYearDatePeriod = (startDate, endDate) => {
  const finalStartDate = new Date(startDate);
  const finalEndDate = new Date(endDate);
  finalEndDate.setFullYear(finalEndDate.getFullYear() - 1);
  finalStartDate.setFullYear(finalStartDate.getFullYear() - 1);
  return {
    previousStartDate: finalStartDate,
    previousEndDate: finalEndDate,
  };
};
/**
 * Parses a slot start time into a full UTC Date.
 * - Full ISO datetime ("2026-09-16T04:15:00.000Z", or a space-separated
 *   "2026-09-16 04:15:00") → parsed directly.
 * - Legacy "HH:mm" / "HH:mm:ss" → anchored onto the given base day (UTC).
 * Returns null for unparseable values.
 */
export const parseSlotStartTime = (
  startTime: string,
  base: Date,
): Date | null => {
  const raw = String(startTime || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh > 23 || mm > 59) return null;
  const d = new Date(base);
  d.setUTCHours(hh, mm, 0, 0);
  return d;
};

/**
 * Resolves the exact booked start-time slot(s) for a scheduled ride.
 *
 * - Prefers the nearest FUTURE slot (booking time may be 07:00 while the actual
 *   availability slot is 08:00 → stores the matched "08:00" slot).
 * - Falls back to the nearest past slot only when every slot has already passed.
 * - Never throws: if nothing matches it returns [{ startTime: bookingTime }]
 *   so the surrounding booking flow keeps working and a startTime is always set
 *   (never an empty/`_id`-only slot).
 *
 * Handles both full-ISO datetimes and legacy "HH:mm" availability slots.
 */
export const resolveBookedTimeSlots = (
  bookingTime: Date,
  timeSlots: Array<{ startTime?: string | null }>,
): Array<{ startTime: string }> => {
  const target = new Date(bookingTime).getTime();
  // Base day (UTC midnight) to anchor legacy "HH:mm" slots to the booking day.
  const base = new Date(target);
  base.setUTCHours(0, 0, 0, 0);

  let bestFuture: string | null = null;
  let bestFutureDiff = Number.MAX_VALUE;
  let bestPast: string | null = null;
  let bestPastDiff = Number.MAX_VALUE;

  for (const slot of timeSlots) {
    if (!slot?.startTime) continue;
    const start = parseSlotStartTime(String(slot.startTime), base);
    if (!start) continue;
    const slotTime = start.getTime();
    const diff = Math.abs(slotTime - target);

    if (slotTime >= target) {
      // Future slot: keep the nearest one.
      if (diff < bestFutureDiff) {
        bestFutureDiff = diff;
        bestFuture = String(slot.startTime);
      }
    } else {
      // Past slot: only considered when no future slot exists.
      if (diff < bestPastDiff) {
        bestPastDiff = diff;
        bestPast = String(slot.startTime);
      }
    }
  }

  const best = bestFuture ?? bestPast;
  return best
    ? [{ startTime: best }]
    : [{ startTime: new Date(bookingTime).toISOString() }];
};
