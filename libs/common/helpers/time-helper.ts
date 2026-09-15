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

/** A time-slot entity carrying an optional start time (availability day slot). */
export interface TimeSlotLike {
  startTime?: string | null;
}

/** Result of resolving the booked slot(s) for a scheduled ride booking. */
export interface TimeSlotResolution {
  /** Resolved booked slot(s) to persist. Always non-empty — never throws. */
  timeSlots: Array<{ startTime: string }>;
  /**
   * `false` when no future time slot was available (only past slots remained)
   * or when no nearest slot could be matched at all. The flow is NOT broken:
   * a fallback slot is still returned and the problem is logged on the console.
   */
  resolved: boolean;
  /** Human-readable diagnostic explaining why `resolved` is `false`. */
  reason?: string;
}

/**
 * Resolves the exact booked start-time slot(s) matching a booking time.
 *
 * - Prefers the nearest FUTURE slot (start >= booking time), so a past slot is
 *   never selected merely because its absolute difference to the booking time
 *   happens to be smaller than a future slot's.
 * - Falls back to the nearest past slot only when every slot has already passed.
 * - Never throws. When there is NO future slot or NO nearest time slot it logs
 *   an error on the console and returns a fallback (the raw booking time) so the
 *   surrounding flow keeps working.
 *
 * Reusable across the whole app via `@libs/common`.
 */
export const resolveBookedTimeSlots = (
  bookingTime: Date,
  timeSlots: TimeSlotLike[],
): TimeSlotResolution => {
  const target = new Date(bookingTime).getTime();

  let bestFuture: string | null = null;
  let bestFutureDiff = Number.MAX_VALUE;
  let bestPast: string | null = null;
  let bestPastDiff = Number.MAX_VALUE;

  for (const slot of timeSlots) {
    if (!slot?.startTime) continue;
    const start = new Date(slot.startTime);
    if (isNaN(start.getTime())) continue;
    const diff = Math.abs(start.getTime() - target);

    if (start.getTime() >= target) {
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
  const result: TimeSlotResolution = {
    timeSlots: [],
    resolved: true,
  };

  if (best) {
    result.timeSlots.push({ startTime: best });

    // No future slot available — every remaining slot has already passed.
    if (!bestFuture) {
      result.resolved = false;
      result.reason =
        `No future time slot is available; fell back to the nearest past slot ` +
        `(${best}).`;
      console.warn(
        `[resolveBookedTimeSlots] ${result.reason} bookingTime=${new Date(
          bookingTime,
        ).toISOString()} slots=${JSON.stringify(timeSlots)}`,
      );
    }
  } else {
    // No nearest (future or past) slot could be parsed/matched at all.
    result.resolved = false;
    result.reason =
      'No matching time slot was found (no future and no nearest slot); ' +
      'falling back to the raw booking time.';
    result.timeSlots = [{ startTime: new Date(bookingTime).toISOString() }];
    console.warn(
      `[resolveBookedTimeSlots] ${result.reason} bookingTime=${new Date(
        bookingTime,
      ).toISOString()} slots=${JSON.stringify(timeSlots)}`,
    );
  }

  return result;
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
 * Parses a slot start time into a full UTC Date. Supports full ISO datetimes
 * (e.g. "2026-09-01T16:00:00.000Z", the format persisted on a ride's booked
 * schedule slot) and legacy "HH:mm" / "HH:mm:ss" values anchored onto the given
 * base date. Returns null for unparseable values.
 */
export const parseSlotStartTime = (
  startTime: string,
  base: Date,
): Date | null => {
  const raw = String(startTime || "").trim();
  if (!raw) return null;
  // Full ISO datetime (contains a date part) — parse directly.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  // Legacy "HH:mm" / "HH:mm:ss" — anchor to the base day (UTC).
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh > 23 || mm > 59) return null;
  const d = new Date(base);
  d.setUTCHours(hh, mm, 0, 0);
  return d;
};
