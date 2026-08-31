import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";
import axios from "axios";
import { ErrorException, MATCHMAKING_CONFIG, toMongoId } from "@libs/common";
import { EnvService } from "@libs/common/config/env.service";
import {
  AddAvailabilityInput,
  AvailabilityDayInput,
  UpdateAvailabilityInput,
} from "@libs/data-access/dtos/input/availability.input";
import { AvailabilityDayDetail } from "@libs/data-access/dtos/response/availability.response";
import { BasicResponse } from "@libs/data-access/dtos/response/basic.response";
import {
  AvailabilityDay,
  AvailabilityDocument,
  DayOfWeek,
  VEHICLE_SEAT_CAPACITY,
} from "@libs/data-access/entities/availability.entity";
import { AvailabilityRepository } from "@libs/data-access/repositories/availability.repository";
import { VehicleRepository } from "@libs/data-access/repositories/vehicle.repository";
import { ScheduledVehicleType, VehicleType } from "@libs/data-access/enums/vehicle.enum";
import { SavedLocation } from "@libs/data-access/common/saved-location";

/** Average speed (km/h) used to estimate trip duration for system fare. */
const ESTIMATED_AVG_SPEED_KMPH = 30;
/** Earth radius in kilometres for the haversine formula. */
const EARTH_RADIUS_KM = 6371;

/** Converts degrees to radians. */
const degreesToRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * All availability week boundaries are calculated in NEPAL time (UTC+5:45,
 * no DST) so that startDate/endDate are correct for Nepali days regardless
 * of the server's own timezone.
 */
const NEPAL_TZ_OFFSET_MINUTES = 345;

/** Shifts an instant into Nepal wall-clock (use with UTC getters/setters). */
const toNepalWallClock = (d: Date): Date =>
  new Date(d.getTime() + NEPAL_TZ_OFFSET_MINUTES * 60000);

/** Converts a Nepal wall-clock value back to the real instant. */
const fromNepalWallClock = (d: Date): Date =>
  new Date(d.getTime() - NEPAL_TZ_OFFSET_MINUTES * 60000);

/**
 * Returns the given date truncated to UTC midnight. Availability day dates
 * are stored and compared in UTC-midnight form so that a client-sent
 * "2026-08-30" and the stored value always represent the same calendar day,
 * regardless of the server's timezone.
 */
const utcStartOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

const dayOfWeekFromDate = (d: Date): DayOfWeek => {
  const map: Record<number, DayOfWeek> = {
    0: DayOfWeek.SUNDAY,
    1: DayOfWeek.MONDAY,
    2: DayOfWeek.TUESDAY,
    3: DayOfWeek.WEDNESDAY,
    4: DayOfWeek.THURSDAY,
    5: DayOfWeek.FRIDAY,
    6: DayOfWeek.SATURDAY,
  };
  return map[toNepalWallClock(d).getUTCDay()];
};

/**
 * Maximum number of days ahead (including today) that availability can be
 * set for: today, today+1 ... today+6.
 */
export const MAX_AVAILABILITY_DAYS_AHEAD = 6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole-day difference between `d` and today (negative when in the past). */
const dayOffsetFromToday = (d: Date): number =>
  Math.round((utcStartOfDay(d).getTime() - utcStartOfDay(new Date()).getTime()) / MS_PER_DAY);

/**
 * Calendar-day key ("YYYY-MM-DD") of an instant in UTC.
 */
const utcDateKey = (d: Date): string => utcStartOfDay(d).toISOString().slice(0, 10);

/**
 * Calendar-day key ("YYYY-MM-DD") of an instant in NEPAL time.
 * Used alongside the UTC key so that availability days stored with the
 * older Nepal-midnight convention (legacy rows) still match the same
 * calendar date and cannot slip through duplicate checks.
 */
const nepalDateKey = (d: Date): string => toNepalWallClock(d).toISOString().slice(0, 10);

/**
 * Returns true when a stored day's date refers to ANY of the given
 * calendar-day keys (UTC or Nepal interpretation).
 */
const dayMatchesAnyKey = (dayDate: Date, keys: Set<string>): boolean =>
  keys.has(utcDateKey(dayDate)) || keys.has(nepalDateKey(dayDate));

/** Both calendar keys (UTC + Nepal) of a requested date. */
const dateKeysOf = (d: Date): Set<string> => {
  const x = new Date(d);
  return new Set([utcDateKey(x), nepalDateKey(x)]);
};

/**
 * Returns true when `d` is within the editable window:
 * today ... today + MAX_AVAILABILITY_DAYS_AHEAD (e.g. Monday + 6 = Sunday).
 * Past dates and dates further out are not editable.
 */
const isInEditableWindow = (d: Date): boolean => {
  const offset = dayOffsetFromToday(d);
  return offset >= 0 && offset <= MAX_AVAILABILITY_DAYS_AHEAD;
};

/**
 * Validates that a date can receive availability changes:
 * - must be today or up to 6 days from today, and
 * - must not have already passed.
 */
const assertEditableDate = (d: Date): void => {
  if (!isInEditableWindow(d)) {
    ErrorException(null, "AVAILABILITY.ONLY_CURRENT_WEEK_ALLOWED", HttpStatus.BAD_REQUEST);
  }
};

/**
 * Minimal view of an availability day used internally after normalization.
 * Mirrors the stored AvailabilityDay fields we read/write.
 */
interface AvailabilityDayLike {
  useSystemFare?: boolean;
  amount?: number | null;
  vehicleType: ScheduledVehicleType | VehicleType;
  availableSeats?: number | null;
  isAvailableForBookings?: boolean | null;
  isOneWay?: boolean | null;
  notes?: string | null;
  pickupLocation?: SavedLocation | null;
  dropOffLocation?: SavedLocation | null;
  timeSlots?: { startTime: string }[];
  majorStops?: string[] | null;
  pickupBufferTimeMinutes?: number | null;
}

/**
 * Parses a time-slot start value ("HH:mm" or any parseable date string)
 * into a comparable millisecond value. NaN when unparseable.
 */
const parseSlotStartMs = (startTime: string): number => {
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

/** Minimum gap between two time-slot start times: 3 hours. */
const TIME_SLOT_MIN_GAP_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly vehicleRepository: VehicleRepository,
    private readonly envService: EnvService,
  ) {}

  /**
   * Validates the time-slot rules for an availability day:
   * - one-way trip  → exactly ONE time slot;
   * - round trip    → exactly TWO time slots;
   * - no two slots may share the same start time;
   * - every pair of start times must be at least 3 hours apart.
   */
  private assertTimeSlotRules(
    isOneWay: boolean,
    slots?: { startTime: string }[] | null,
  ): void {
    const list = slots || [];
    const required = isOneWay ? 1 : 2;
    if (list.length !== required) {
      ErrorException(
        null,
        isOneWay
          ? "AVAILABILITY.ONE_WAY_ONE_SLOT"
          : "AVAILABILITY.ROUND_TRIP_TWO_SLOTS",
        HttpStatus.BAD_REQUEST,
      );
    }

    const times = list.map((s) => parseSlotStartMs(s.startTime));
    if (times.some((t) => isNaN(t))) {
      ErrorException(null, "AVAILABILITY.TIME_SLOT_INVALID", HttpStatus.BAD_REQUEST);
    }

    for (let i = 0; i < times.length; i++) {
      for (let j = i + 1; j < times.length; j++) {
        if (times[i] === times[j]) {
          ErrorException(null, "AVAILABILITY.TIME_SLOT_DUPLICATE", HttpStatus.CONFLICT);
        }
        if (Math.abs(times[i] - times[j]) < TIME_SLOT_MIN_GAP_MS) {
          ErrorException(null, "AVAILABILITY.TIME_SLOT_MIN_GAP", HttpStatus.BAD_REQUEST);
        }
      }
    }
  }

  async addWeeklyAvailability(
    driverId: string | Types.ObjectId,
    input: AddAvailabilityInput,
  ): Promise<AvailabilityDocument> {
    // Availability can only be added for ONE day per request.
    if (input.days.length !== 1) {
      ErrorException(null, "AVAILABILITY.ONE_DAY_AT_A_TIME", HttpStatus.BAD_REQUEST);
    }

    const driverVehicleType = await this.getDriverVehicleType(driverId);

    // Validate each requested date: must be today up to 6 days from today,
    // and the weekday enum must match the supplied date's weekday.
    for (const d of input.days) {
      if (!d.date || isNaN(new Date(d.date).getTime())) {
        ErrorException(null, "AVAILABILITY.INVALID_DAY", HttpStatus.BAD_REQUEST);
      }
      const dayDate = utcStartOfDay(new Date(d.date));
      assertEditableDate(dayDate);
      const derivedDay = dayOfWeekFromDate(dayDate);
      if (d.day !== derivedDay) {
        ErrorException(null, "AVAILABILITY.INVALID_DAY", HttpStatus.BAD_REQUEST);
      }
    }

    // Normalize stored days — each day carries its concrete date.
    const days = await this.toStoredDays(input.days, driverVehicleType);

    let existing = await this.availabilityRepository.findByDriver(driverId);
    if (!existing) {
      return this.availabilityRepository.createAvailability({
        driverId: driverId instanceof Types.ObjectId ? driverId : toMongoId(driverId),
        days,
      });
    }

    const existingDays = (existing.days || []).map((d: any) =>
      typeof d.toObject === "function" ? d.toObject() : d,
    );

    // Duplicate check: the same calendar DATE cannot be added twice.
    // Compares both UTC and Nepal calendar-day keys so legacy rows stored
    // with the Nepal-midnight convention are still detected as duplicates.
    const newDay = days[0];
    const newDayKeys = dateKeysOf(new Date(newDay.date));
    if (existingDays.some((d) => d.date && dayMatchesAnyKey(new Date(d.date), newDayKeys))) {
      ErrorException(null, "AVAILABILITY.DUPLICATE_DAY", HttpStatus.CONFLICT);
    }

    // A driver can have at most 7 days of availability at any time
    // (today ... today+6; expired days are pruned below).
    const upcomingDays = existingDays.filter(
      (d) => d.date && utcStartOfDay(new Date(d.date)).getTime() >= utcStartOfDay(new Date()).getTime(),
    );
    if (upcomingDays.length + 1 > MAX_AVAILABILITY_DAYS_AHEAD + 1) {
      ErrorException(null, "AVAILABILITY.MAX_DAYS_REACHED", HttpStatus.BAD_REQUEST);
    }

    // Prune past days so the document keeps rolling forward with time.
    const mergedDays = [...upcomingDays, newDay];
    return (
      (await this.availabilityRepository.updateById(existing._id, {
        days: mergedDays,
      })) || existing
    );
  }

  async getAvailabilityByDate(driverId: string | Types.ObjectId, date: Date): Promise<AvailabilityDayDetail> {
    const dayDate = utcStartOfDay(new Date(date));
    const doc = await this.availabilityRepository.findByDriver(driverId);
    if (!doc) {
      ErrorException(null, "AVAILABILITY.WEEK_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const found = (doc.days || []).find(
      (d) => d.date && dayMatchesAnyKey(new Date(d.date), dateKeysOf(date)),
    );
    if (!found) {
      ErrorException(null, "AVAILABILITY.DAY_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return {
      date: dayDate,
      day: found.day,
      vehicleType: found.vehicleType,
      isAvailableForBookings: found.isAvailableForBookings ?? true,
      isOneWay: found.isOneWay ?? false,
      availableSeats: found.availableSeats ?? VEHICLE_SEAT_CAPACITY[found.vehicleType],
      useSystemFare: found.useSystemFare ?? true,
            amount: found.amount ?? 0,
      timeSlots: found.timeSlots || [],
      majorStops: found.majorStops || [],
      pickupBufferTimeMinutes: found.pickupBufferTimeMinutes ?? 0,
      pickupLocation: found.pickupLocation || undefined,
      dropOffLocation: found.dropOffLocation || undefined,
      notes: found.notes || null,
    };
  }

  async getAvailabilityWeek(driverId: string | Types.ObjectId, date?: Date): Promise<AvailabilityDocument | null> {
    // No week boundaries anymore — return the driver's rolling availability
    // document with past days filtered out and the remaining days sorted
    // by date: latest coming (soonest upcoming) first.
    const doc = await this.availabilityRepository.findByDriver(driverId);
    if (!doc) return null;
    const todayStart = utcStartOfDay(new Date());
    const upcomingDays = (doc.days || [])
      .filter((d) => d.date && utcStartOfDay(new Date(d.date)).getTime() >= todayStart.getTime())
      .sort(
        (a, b) => utcStartOfDay(new Date(a.date)).getTime() - utcStartOfDay(new Date(b.date)).getTime(),
      );
    doc.days = upcomingDays;
    return doc;
  }

  async updateAvailability(driverId: string | Types.ObjectId, input: UpdateAvailabilityInput): Promise<AvailabilityDocument | null> {
    this.logger.log(
      `updateAvailability called: date=${input.date} useSystemFare=${input.useSystemFare} amount=${input.amount}`,
    );
    const dayDate = utcStartOfDay(new Date(input.date));
    assertEditableDate(dayDate);
    const day = dayOfWeekFromDate(dayDate);
    const doc = await this.availabilityRepository.findByDriver(driverId);
    if (!doc) {
      ErrorException(null, "AVAILABILITY.WEEK_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const existing = (doc.days || []).find(
      (d) => d.date && utcStartOfDay(new Date(d.date)).getTime() === dayDate.getTime(),
    );
    this.logger.log(
      `updateAvailability: day=${day} existing=${JSON.stringify(existing)}`,
    );
    if (!existing) {
      ErrorException(null, "AVAILABILITY.DAY_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    // Convert the Mongoose subdocument to a plain object first — spreading it
    // directly leaks internal state ($__parentArray, $__, _doc, $isNew) into
    // the update payload, which corrupts/blocks the write.
    const existingPlain =
      typeof (existing as any).toObject === "function"
        ? (existing as any).toObject()
        : { ...existing };
    const updatedDay: Partial<AvailabilityDay> = {
      ...existingPlain,
      day,
      // Always store the normalized UTC-midnight form of the requested date.
      date: dayDate,
    };
    this.logger.log(`updateAvailability: day=${day} before update=${JSON.stringify(updatedDay)}`);
    if (input.timeSlots !== undefined) updatedDay.timeSlots = input.timeSlots;
    if (input.majorStops !== undefined) updatedDay.majorStops = input.majorStops;
    if (input.pickupBufferTimeMinutes !== undefined) updatedDay.pickupBufferTimeMinutes = input.pickupBufferTimeMinutes;
    if (input.pickupLocation !== undefined) updatedDay.pickupLocation = input.pickupLocation;
    if (input.dropOffLocation !== undefined) updatedDay.dropOffLocation = input.dropOffLocation;
    if (input.notes !== undefined) updatedDay.notes = input.notes;
    if (input.vehicleType !== undefined) updatedDay.vehicleType = input.vehicleType;
    if (input.isAvailableForBookings !== undefined)
      updatedDay.isAvailableForBookings = input.isAvailableForBookings;
    if (input.isOneWay !== undefined) updatedDay.isOneWay = input.isOneWay;
    if (input.availableSeats !== undefined) updatedDay.availableSeats = input.availableSeats;
    if (input.useSystemFare !== undefined) updatedDay.useSystemFare = input.useSystemFare;
    if (input.amount !== undefined) updatedDay.amount = input.amount;
    // If the fare mode switched to system fare (e.g. previously added with
    // useSystemFare=false), discard any custom amount so the system fare is
    // always freshly calculated below.
    if (input.useSystemFare === true) {
      updatedDay.amount = undefined;
    }
    // Validate slots: valid date, within window, not passed, matching weekday.
    this.assertValidTimeSlots(day, updatedDay.timeSlots || []);
    // One-way → exactly 1 slot; round trip → exactly 2 slots,
    // no duplicates and at least 3 hours between start times.
    this.assertTimeSlotRules(updatedDay.isOneWay ?? false, updatedDay.timeSlots);
    if (
      updatedDay.useSystemFare === false &&
      (updatedDay.amount === undefined ||
        updatedDay.amount === null ||
        updatedDay.amount <= 0)
    ) {
      ErrorException(null, "AVAILABILITY.AMOUNT_REQUIRED", HttpStatus.BAD_REQUEST);
    }
    updatedDay.amount = await this.resolveDayAmount(
      updatedDay as AvailabilityDayLike,
      await this.getDriverVehicleType(driverId),
    );
    this.logger.log(
      `updateAvailability: day=${day} useSystemFare=${updatedDay.useSystemFare} -> amount=${updatedDay.amount}`,
    );
    // Replace the day matching the requested date AND drop any other legacy
    // rows that refer to the same calendar date (UTC or Nepal interpretation),
    // so duplicates can never accumulate for one date.
    const targetKeys = dateKeysOf(new Date(input.date));
    let replaced = false;
    const newDays = (doc.days || []).flatMap((d) => {
      const plain = typeof (d as any).toObject === "function" ? (d as any).toObject() : d;
      if (!plain.date || !dayMatchesAnyKey(new Date(plain.date), targetKeys)) {
        return [plain];
      }
      if (replaced) {
        // Duplicate legacy row for the same date — remove it.
        return [];
      }
      replaced = true;
      return [updatedDay];
    });
    await this.availabilityRepository.updateById(doc._id, { days: newDays });
    return this.availabilityRepository.findByDriver(driverId);
  }

  async removeAvailability(driverId: string | Types.ObjectId, date: Date): Promise<BasicResponse> {
    const dayDate = utcStartOfDay(new Date(date));
    assertEditableDate(dayDate);
    const doc = await this.availabilityRepository.findByDriver(driverId);
    if (!doc) {
      ErrorException(null, "AVAILABILITY.WEEK_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const days = (doc.days || []).filter(
      (d) => !(d.date && dayMatchesAnyKey(new Date(d.date), dateKeysOf(date))),
    );
    if (days.length === (doc.days || []).length) {
      ErrorException(null, "AVAILABILITY.DAY_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    await this.availabilityRepository.updateById(doc._id, { days });
    return { success: true, message: "AVAILABILITY.AVAILABILITY_REMOVED" };
  }

  /**
   * Deletes all PAST availability days (date strictly before today, UTC)
   * across every driver's availability document.
   *
   * Called by the cron app's midnight job (`0 0 * * *`) so expired days never
   * accumulate, but also exposed as an instant-delete mutation so operators /
   * QA can trigger the same cleanup on demand without waiting for midnight.
   *
   * Today's days are kept — only fully elapsed calendar dates are removed.
   */
  async deletePastAvailabilityDays(): Promise<{
    processed: number;
    documentsCleaned: number;
    removedDays: number;
  }> {
    const todayStart = utcStartOfDay(new Date()).getTime();
    const docs = await this.availabilityRepository.find({ deleted: false });

    let documentsCleaned = 0;
    let removedDays = 0;

    for (const doc of docs || []) {
      const allDays = doc.days || [];
      const kept = allDays.filter(
        (d) =>
          d.date &&
          utcStartOfDay(new Date(d.date)).getTime() >= todayStart,
      );
      if (kept.length === allDays.length) continue;

      await this.availabilityRepository.updateById(doc._id, { days: kept });
      removedDays += allDays.length - kept.length;
      documentsCleaned++;
      this.logger.log(
        `Pruned ${allDays.length - kept.length} past day(s) from driver ${doc.driverId}`,
      );
    }

    this.logger.log(
      `Availability past-day sweep complete: processed=${docs?.length || 0}, documentsCleaned=${documentsCleaned}, removedDays=${removedDays}`,
    );
    return {
      processed: docs?.length || 0,
      documentsCleaned,
      removedDays,
    };
  }

  private async toStoredDays(
    days: AvailabilityDayInput[],
    driverVehicleType: ScheduledVehicleType ,
  ): Promise<AvailabilityDay[]> {
    const stored: AvailabilityDay[] = [];
    for (const day of days) {
      this.assertValidTimeSlots(day.day, day.timeSlots || []);
      // One-way → exactly 1 slot; round trip → exactly 2 slots,
      // no duplicates and at least 3 hours between start times.
      this.assertTimeSlotRules(day.isOneWay ?? false, day.timeSlots);
      if (
        day.useSystemFare === false &&
        (day.amount === undefined || day.amount === null || day.amount <= 0)
      ) {
        ErrorException(null, "AVAILABILITY.AMOUNT_REQUIRED", HttpStatus.BAD_REQUEST);
      }
      stored.push({
        day: day.day,
        date: utcStartOfDay(new Date(day.date)),
        timeSlots: day.timeSlots || [],
        majorStops: day.majorStops || [],
        pickupBufferTimeMinutes: day.pickupBufferTimeMinutes ?? 0,
        pickupLocation: day.pickupLocation || null,
        dropOffLocation: day.dropOffLocation || null,
        notes: day.notes || null,
        vehicleType: day.vehicleType,
        isAvailableForBookings: day.isAvailableForBookings ?? true,
        isOneWay: day.isOneWay ?? false,
        availableSeats: day.availableSeats ?? VEHICLE_SEAT_CAPACITY[day.vehicleType],
        useSystemFare: day.useSystemFare ?? true,
        amount: await this.resolveDayAmount(day, driverVehicleType),
      } as AvailabilityDay);
    }
    return stored;
  }

  /**
   * Validates each time slot of an availability day:
   * - `startTime` must be a valid date,
   * - it must belong to the current week and not have passed yet,
   * - its day-of-week must match the availability day it belongs to.
   */
  private assertValidTimeSlots(day: DayOfWeek, slots: { startTime: string }[]): void {
    for (const slot of slots) {
      const slotDate = new Date(slot.startTime);
      if (isNaN(slotDate.getTime())) {
        ErrorException(null, "AVAILABILITY.TIME_SLOT_INVALID", HttpStatus.BAD_REQUEST);
      }
      assertEditableDate(utcStartOfDay(slotDate));
      if (dayOfWeekFromDate(slotDate) !== day) {
        ErrorException(null, "AVAILABILITY.TIME_SLOT_DAY_MISMATCH", HttpStatus.BAD_REQUEST);
      }
    }
  }

  /**
   * Resolves the fare amount for a single availability day.
   * - When useSystemFare is true  → computed from MATCHMAKING_CONFIG.SCHEDULED_FARE
   *   using the driver's actual registered vehicle type and the road distance
   *   between pickup & dropoff points from the Baato routing API.
   * - When useSystemFare is false → amount equals the driver's supplied amount.
   */
  private async resolveDayAmount(
    day: AvailabilityDayLike,
    driverVehicleType: ScheduledVehicleType ,
  ): Promise<number> {
    const useSystemFare = day.useSystemFare ?? true;
    if (!useSystemFare) {
      return Number(day.amount ?? 0);
    }
    return this.calculateSystemFare(
      driverVehicleType,
      day.pickupLocation,
      day.dropOffLocation,
    );
  }

  /**
   * Calculates the system fare from MATCHMAKING_CONFIG.SCHEDULED_FARE.
   * Distance/duration come from the Baato routing API (haversine fallback).
   * amount = (basePickupCost + perKm * distanceKm + perMinute * durationMinutes) * multiplier
   */
  private async calculateSystemFare(
    vehicle: ScheduledVehicleType ,
    pickup?: SavedLocation | null,
    dropoff?: SavedLocation | null,
  ): Promise<number> {
    const config = MATCHMAKING_CONFIG.SCHEDULED_FARE;
    const basePickupCost = config.BASE_PICKUP_COST[vehicle] ?? config.BASE_PICKUP_COST.CAR;
    const perKmRate = config.PER_KM_RATE[vehicle] ?? config.PER_KM_RATE.CAR;
    const perMinuteRate = config.PER_MINUTE_RATE[vehicle] ?? config.PER_MINUTE_RATE.CAR;
    const multiplier = config.RIDE_TYPE_MULTIPLIER[vehicle] ?? 1;

    let distanceKm = 0;
    let durationMinutes = 0;
    if (
      pickup?.latitude != null &&
      pickup?.longitude != null &&
      dropoff?.latitude != null &&
      dropoff?.longitude != null
    ) {
      const route = await this.getBaatoRoute(pickup, dropoff, vehicle);
      distanceKm = route.distanceKm;
      durationMinutes = route.durationMinutes;
    }

    const baseFare =
      basePickupCost + perKmRate * distanceKm + perMinuteRate * durationMinutes;
    const amount = Math.round(baseFare * multiplier);
    this.logger.debug(
      `calculateSystemFare: vehicle=${vehicle} distanceKm=${distanceKm} durationMinutes=${durationMinutes} -> amount=${amount}`,
    );
    return amount;
  }

  /**
   * Fetches road distance & duration between pickup and drop-off via the Baato
   * directions API. Falls back to the haversine estimate when the API key is
   * missing or the request fails.
   */
  private async getBaatoRoute(
    pickup: SavedLocation,
    dropoff: SavedLocation,
    vehicle: ScheduledVehicleType,
  ): Promise<{ distanceKm: number; durationMinutes: number }> {
    const apiKey = this.envService.getBaatoApiKey();
    const baseUrl = this.envService.getBaatoApiUrl();

    if (!apiKey || !baseUrl) {
      this.logger.warn("Baato API not configured. Using haversine fallback.");
      return this.haversineEstimate(pickup, dropoff);
    }

    try {
      const response = await axios.get(`${baseUrl}/directions`, {
        params: {
          key: apiKey,
          "points[]": [
            `${pickup.latitude},${pickup.longitude}`,
            `${dropoff.latitude},${dropoff.longitude}`,
          ],
          mode: vehicle === ScheduledVehicleType.CAR ? "car" : "car",
        },
      });
      const route = response.data?.data?.[0];
      if (route?.distanceInMeters != null && route?.timeInMs != null) {
        return {
          distanceKm: Number((route.distanceInMeters / 1000).toFixed(2)),
          durationMinutes: Math.round(route.timeInMs / 1000 / 60),
        };
      }
      this.logger.warn(
        `Baato returned no routes (${pickup.latitude},${pickup.longitude} → ${dropoff.latitude},${dropoff.longitude}). Using haversine fallback.`,
      );
      return this.haversineEstimate(pickup, dropoff);
    } catch (error: any) {
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message;
      this.logger.error(`Baato API error: ${detail}. Using haversine fallback.`);
      return this.haversineEstimate(pickup, dropoff);
    }
  }

  /** Haversine distance/duration fallback when Baato is unavailable. */
  private haversineEstimate(
    pickup: SavedLocation,
    dropoff: SavedLocation,
  ): { distanceKm: number; durationMinutes: number } {
    const distanceKm = Number(
      this.haversineDistanceKm(
        pickup.latitude!,
        pickup.longitude!,
        dropoff.latitude!,
        dropoff.longitude!,
      ).toFixed(2),
    );
    const durationMinutes = Math.round((distanceKm / ESTIMATED_AVG_SPEED_KMPH) * 60);
    return { distanceKm, durationMinutes };
  }

  /** Looks up the driver's registered vehicle type (CAR / JEEP / MICRO). */
  private async getDriverVehicleType(
    driverId: string | Types.ObjectId,
  ): Promise<ScheduledVehicleType > {
    const vehicle = await this.vehicleRepository.findOne({
      driverId: driverId instanceof Types.ObjectId ? driverId : toMongoId(driverId),
      deleted: false,
    });
     return (vehicle?.vehicleType as ScheduledVehicleType) ??
    ScheduledVehicleType.CAR;
  }

  /** Great-circle distance between two coordinates in kilometres (haversine). */
  private haversineDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const dLat = degreesToRadians(lat2 - lat1);
    const dLng = degreesToRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(degreesToRadians(lat1)) *
        Math.cos(degreesToRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }
}
