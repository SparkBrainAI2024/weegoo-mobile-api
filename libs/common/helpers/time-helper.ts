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
 * Nepal standard time offset is UTC+5:45 (no DST). Kept private; use
 * `toNepalWallClock` / `fromNepalWallClock` instead.
 */
const NEPAL_TZ_OFFSET_MINUTES = 345;

/** Shifts an instant into Nepal wall-clock (use with UTC getters/setters). */
export const toNepalWallClock = (d: Date): Date =>
  new Date(d.getTime() + NEPAL_TZ_OFFSET_MINUTES * 60000);

/** Converts a Nepal wall-clock value back to the real instant. */
export const fromNepalWallClock = (d: Date): Date =>
  new Date(d.getTime() - NEPAL_TZ_OFFSET_MINUTES * 60000);

/**
 * Resolves a time-slot `startTime` as a Date whose UTC fields hold the Nepal
 * wall-clock value (so callers can read .getUTCDay(), .getUTCHours(), … directly
 * without any further offset).
 *
 * - String WITH a timezone designator (trailing `Z` or `±HH:MM`) is an absolute
 *   instant → shift it once into Nepal wall-clock.
 * - Naive string WITHOUT a timezone is already NEPAL wall-clock (this is what
 *   the frontend sends) → its literal date/time fields are used as-is.
 * - Returns null for unparseable values or a string with no date part.
 */
export const nepalWallClockOfSlot = (startTime: string): Date | null => {
  const s = String(startTime ?? "").trim();
  if (!s) return null;

  // Full ISO datetime carrying an explicit timezone → absolute instant.
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return toNepalWallClock(d);
  }

  // Naive ISO datetime (no timezone) → already Nepal wall-clock.
  // Matches e.g. "2026-09-01", "2026-09-01T23:00:00", "2026-09-01T23:00:00.000".
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/.exec(
      s,
    );
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    const h = Number(m[4] || 0);
    const mi = Number(m[5] || 0);
    const se = Number(m[6] || 0);
    const ms = Number((m[7] || "").padEnd(3, "0") || "0");
    if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59 || se > 59) {
      return null;
    }
    return new Date(Date.UTC(y, mo - 1, da, h, mi, se, ms));
  }

  return null;
};

/**
 * Parses a time-slot start value ("HH:mm" or any parseable date string)
 * into a comparable millisecond value. NaN when unparseable.
 */
export const parseSlotStartMs = (startTime: string): number => {
  const s = String(startTime ?? "").trim();
  const hm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (hm) {
    const h = parseInt(hm[1], 10);
    const m = parseInt(hm[2], 10);
    if (h > 23 || m > 59) return NaN;
    return (h * 60 + m) * 60000;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? NaN : d.getTime();
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
 * Resolves WHICH of a driver availability day's time slots a booking falls in.
 *
 * Selection rule (shared with `resolveBookedTimeSlots`):
 * - Prefers the nearest FUTURE slot (booking time may be 07:00 while the actual
 *   availability slot is 08:00 → the "08:00" slot is selected).
 * - Falls back to the nearest past slot only when every slot has already passed.
 *
 * Returns the index of the matched slot in the ORIGINAL `timeSlots` array, or
 * -1 when the list is empty / no slot could be parsed. Callers use the index to
 * tell the first slot (outbound leg) apart from the last (return leg).
 *
 * Handles both full-ISO datetimes and legacy "HH:mm" availability slots.
 */
export const resolveBookedSlotIndex = (
  bookingTime: Date,
  timeSlots: Array<{ startTime?: string | null }>,
): number => {
  const target = new Date(bookingTime).getTime();
  // Base day (UTC midnight) to anchor legacy "HH:mm" slots to the booking day.
  const base = new Date(target);
  base.setUTCHours(0, 0, 0, 0);

  let bestFutureIndex = -1;
  let bestFutureDiff = Number.MAX_VALUE;
  let bestPastIndex = -1;
  let bestPastDiff = Number.MAX_VALUE;

  (timeSlots || []).forEach((slot, index) => {
    if (!slot?.startTime) return;
    const start = parseSlotStartTime(String(slot.startTime), base);
    if (!start) return;
    const slotTime = start.getTime();
    const diff = Math.abs(slotTime - target);

    if (slotTime >= target) {
      // Future slot: keep the nearest one.
      if (diff < bestFutureDiff) {
        bestFutureDiff = diff;
        bestFutureIndex = index;
      }
    } else {
      // Past slot: only considered when no future slot exists.
      if (diff < bestPastDiff) {
        bestPastDiff = diff;
        bestPastIndex = index;
      }
    }
  });

  return bestFutureIndex >= 0 ? bestFutureIndex : bestPastIndex;
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
  const index = resolveBookedSlotIndex(bookingTime, timeSlots);
  const matched = index >= 0 ? (timeSlots || [])[index]?.startTime : null;
  return matched
    ? [{ startTime: String(matched) }]
    : [{ startTime: new Date(bookingTime).toISOString() }];
};
