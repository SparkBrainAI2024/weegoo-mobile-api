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

/** Returns the start of the given date's day in Nepal time. */
const startOfDay = (d: Date): Date => {
  const x = toNepalWallClock(d);
  x.setUTCHours(0, 0, 0, 0);
  return fromNepalWallClock(x);
};

const startOfWeekSunday = (d: Date): Date => {
  const x = toNepalWallClock(startOfDay(d));
  x.setUTCDate(x.getUTCDate() - x.getUTCDay()); // Sunday=0 starts the week
  return fromNepalWallClock(x);
};

const addDays = (d: Date, days: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

/**
 * Returns the END of Saturday (23:59:59.999 Nepal time) of the week starting
 * at the given Sunday. In UTC this is Saturday 18:14:59.999 — which is
 * Saturday end-of-day in Nepal, never spilling into a Nepali Sunday.
 */
const endOfWeekSaturday = (weekStart: Date): Date => {
  const x = toNepalWallClock(addDays(startOfDay(weekStart), 6)); // Saturday NPT
  x.setUTCHours(23, 59, 59, 999);
  return fromNepalWallClock(x);
};

/** Maps a date's NEPAL-time weekday to the DayOfWeek enum. */
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
 * Returns true when `d` is a past date (its day-start is before today's
 * day-start). Used to reject any availability operation for a day that has
 * already passed — this covers both a past Sunday and a past weekday.
 */
const isPastDate = (d: Date, now: Date): boolean =>
  startOfDay(d).getTime() < startOfDay(now).getTime();

/**
 * Returns true when `d` falls within the current Monday → Saturday week.
 * Availability add/edit is restricted to the ongoing week only (no future weeks).
 */
const isInCurrentWeek = (d: Date): boolean => {
  const now = new Date();
  return startOfWeekSunday(d).getTime() === startOfWeekSunday(now).getTime();
};

/**
 * Validates that a date can receive availability changes:
 * - must be inside the current (Mon-Sun) week, and
 * - must not have already passed.
 */
const assertEditableDate = (d: Date): void => {
  if (!isInCurrentWeek(d)) {
    ErrorException(null, "AVAILABILITY.ONLY_CURRENT_WEEK_ALLOWED", HttpStatus.BAD_REQUEST);
  }
  if (isPastDate(d, new Date())) {
    ErrorException(null, "AVAILABILITY.PAST_DATE_NOT_ALLOWED", HttpStatus.BAD_REQUEST);
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

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly vehicleRepository: VehicleRepository,
    private readonly envService: EnvService,
  ) {}

  async addWeeklyAvailability(
    driverId: string | Types.ObjectId,
    input: AddAvailabilityInput,
  ): Promise<AvailabilityDocument> {
    const today = startOfDay(new Date());
    const weekStart = startOfWeekSunday(today);

    // Availability can only be added for ONE day per request.
    if (input.days.length !== 1) {
      ErrorException(null, "AVAILABILITY.ONE_DAY_AT_A_TIME", HttpStatus.BAD_REQUEST);
    }

    // Every requested day must belong to THIS week and must not have passed
    // (this week's days run Sunday → Saturday; a day is blocked once passed).
    const offsets: Record<string, number> = {
      [DayOfWeek.SUNDAY]: 0,
      [DayOfWeek.MONDAY]: 1,
      [DayOfWeek.TUESDAY]: 2,
      [DayOfWeek.WEDNESDAY]: 3,
      [DayOfWeek.THURSDAY]: 4,
      [DayOfWeek.FRIDAY]: 5,
      [DayOfWeek.SATURDAY]: 6,
    };
    for (const d of input.days) {
      assertEditableDate(addDays(weekStart, offsets[d.day]));
    }

    // Week always ends at end of Saturday.
    const endDate = endOfWeekSaturday(weekStart);
    const driverVehicleType = await this.getDriverVehicleType(driverId);
    const days = await this.toStoredDays(input.days, driverVehicleType);
    const existing = await this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
    if (existing) {
      // Duplicate check: the same day cannot be added twice in a week.
      const newDay = days[0];
      const existingDays = (existing.days || []).map((d: any) =>
        typeof d.toObject === "function" ? d.toObject() : d,
      );
      if (existingDays.some((d) => d.day === newDay.day)) {
        ErrorException(null, "AVAILABILITY.DUPLICATE_DAY", HttpStatus.CONFLICT);
      }
      const mergedDays = [...existingDays, newDay];
      const mergedEndDate = endOfWeekSaturday(weekStart);
      return (
        (await this.availabilityRepository.updateById(existing._id, {
          days: mergedDays,
          endDate: mergedEndDate,
        })) || existing
      );
    }
    return this.availabilityRepository.createAvailability({
      driverId: driverId instanceof Types.ObjectId ? driverId : toMongoId(driverId),
      startDate: weekStart,
      endDate,
      days,
    });
  }

  async getAvailabilityByDate(driverId: string | Types.ObjectId, date: Date): Promise<AvailabilityDayDetail> {
    const dayDate = startOfDay(new Date(date));
    const day = dayOfWeekFromDate(dayDate);
    const weekStart = startOfWeekSunday(dayDate);
    const doc = await this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
    if (!doc) {
      ErrorException(null, "AVAILABILITY.WEEK_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const found = (doc.days || []).find((d) => d.day === day);
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
    const refDate = date ? startOfDay(new Date(date)) : startOfDay(new Date());
    const weekStart = startOfWeekSunday(refDate);
    return this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
  }

  async updateAvailability(driverId: string | Types.ObjectId, input: UpdateAvailabilityInput): Promise<AvailabilityDocument | null> {
    this.logger.log(
      `updateAvailability called: date=${input.date} useSystemFare=${input.useSystemFare} amount=${input.amount}`,
    );
    const dayDate = startOfDay(new Date(input.date));
    assertEditableDate(dayDate);
    const day = dayOfWeekFromDate(dayDate);
    const weekStart = startOfWeekSunday(dayDate);
    const doc = await this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
    if (!doc) {
      ErrorException(null, "AVAILABILITY.WEEK_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const existing = (doc.days || []).find((d) => d.day === day);
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
    const updatedDay: Partial<AvailabilityDay> = { ...existingPlain, day };
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
    // Validate slots: valid date, current week, not passed, matching weekday.
    this.assertValidTimeSlots(day, updatedDay.timeSlots || []);
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
    const newDays = (doc.days || []).map((d) =>
      d.day === day ? updatedDay : (typeof (d as any).toObject === "function" ? (d as any).toObject() : d),
    );
    await this.availabilityRepository.updateById(doc._id, { days: newDays });
    return this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
  }

  async removeAvailability(driverId: string | Types.ObjectId, date: Date): Promise<BasicResponse> {
    const dayDate = startOfDay(new Date(date));
    assertEditableDate(dayDate);
    const day = dayOfWeekFromDate(dayDate);
    const weekStart = startOfWeekSunday(dayDate);
    const doc = await this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
    if (!doc) {
      ErrorException(null, "AVAILABILITY.WEEK_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const days = (doc.days || []).filter((d) => d.day !== day);
    if (days.length === (doc.days || []).length) {
      ErrorException(null, "AVAILABILITY.DAY_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    await this.availabilityRepository.updateById(doc._id, { days });
    return { success: true, message: "AVAILABILITY.AVAILABILITY_REMOVED" };
  }

  private async toStoredDays(
    days: AvailabilityDayInput[],
    driverVehicleType: VehicleType,
  ): Promise<AvailabilityDay[]> {
    const stored: AvailabilityDay[] = [];
    for (const day of days) {
      this.assertValidTimeSlots(day.day, day.timeSlots || []);
      if (
        day.useSystemFare === false &&
        (day.amount === undefined || day.amount === null || day.amount <= 0)
      ) {
        ErrorException(null, "AVAILABILITY.AMOUNT_REQUIRED", HttpStatus.BAD_REQUEST);
      }
      stored.push({
        day: day.day,
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
      assertEditableDate(startOfDay(slotDate));
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
    driverVehicleType: VehicleType,
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
    vehicle: VehicleType,
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
    vehicle: VehicleType,
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
          mode: vehicle === VehicleType.CAR ? "car" : "bike",
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

  /** Looks up the driver's registered vehicle type (CAR / MOTORBIKE / SCOOTER). */
  private async getDriverVehicleType(
    driverId: string | Types.ObjectId,
  ): Promise<VehicleType> {
    const vehicle = await this.vehicleRepository.findOne({
      driverId: driverId instanceof Types.ObjectId ? driverId : toMongoId(driverId),
      deleted: false,
    });
    return vehicle?.vehicleType ?? VehicleType.CAR;
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
