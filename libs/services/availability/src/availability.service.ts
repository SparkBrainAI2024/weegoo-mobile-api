import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { ErrorException, MATCHMAKING_CONFIG, toMongoId } from "@libs/common";
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

/** Average speed (km/h) used to estimate trip duration for system fare. */
const ESTIMATED_AVG_SPEED_KMPH = 30;

const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const startOfWeekMonday = (d: Date): Date => {
  const x = startOfDay(d);
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
};

const addDays = (d: Date, days: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
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
  return map[d.getDay()];
};

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  async addWeeklyAvailability(
    driverId: string | Types.ObjectId,
    input: AddAvailabilityInput,
  ): Promise<AvailabilityDocument> {
    const today = startOfDay(new Date());
    if (today.getDay() !== 0) {
      ErrorException(null, "AVAILABILITY.WEEK_START_ON_SUNDAY_ONLY", HttpStatus.BAD_REQUEST);
    }
    const weekStart = addDays(startOfWeekMonday(today), 7);
    const endDate = addDays(weekStart, 5);
    const driverVehicleType = await this.getDriverVehicleType(driverId);
    const days = this.toStoredDays(input.days, driverVehicleType);
    const existing = await this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
    if (existing) {
      return (await this.availabilityRepository.updateById(existing._id, { days, endDate })) || existing;
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
    const weekStart = startOfWeekMonday(dayDate);
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
    let weekStart = startOfWeekMonday(refDate);
    if (refDate.getDay() === 0) {
      weekStart = addDays(weekStart, 7);
    }
    return this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
  }

  async updateAvailability(driverId: string | Types.ObjectId, input: UpdateAvailabilityInput): Promise<AvailabilityDocument | null> {
    const dayDate = startOfDay(new Date(input.date));
    const day = dayOfWeekFromDate(dayDate);
    const weekStart = startOfWeekMonday(dayDate);
    const doc = await this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
    if (!doc) {
      ErrorException(null, "AVAILABILITY.WEEK_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const existing = (doc.days || []).find((d) => d.day === day);
    if (!existing) {
      ErrorException(null, "AVAILABILITY.DAY_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const updatedDay: Partial<AvailabilityDay> = { ...existing, day };
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
    if (
      updatedDay.useSystemFare === false &&
      (updatedDay.amount === undefined ||
        updatedDay.amount === null ||
        updatedDay.amount <= 0)
    ) {
      ErrorException(null, "AVAILABILITY.AMOUNT_REQUIRED", HttpStatus.BAD_REQUEST);
    }
    updatedDay.amount = this.resolveDayAmount(
      updatedDay,
      await this.getDriverVehicleType(driverId),
    );
    const newDays = (doc.days || []).map((d) => (d.day === day ? updatedDay : d));
    await this.availabilityRepository.updateById(doc._id, { days: newDays });
    return this.availabilityRepository.findByDriverAndWeek(driverId, weekStart);
  }

  async removeAvailability(driverId: string | Types.ObjectId, date: Date): Promise<BasicResponse> {
    const dayDate = startOfDay(new Date(date));
    const day = dayOfWeekFromDate(dayDate);
    const weekStart = startOfWeekMonday(dayDate);
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

  private toStoredDays(
    days: AvailabilityDayInput[],
    driverVehicleType: VehicleType,
  ): AvailabilityDay[] {
    return days.map((day) => {
      if (day.day === DayOfWeek.SUNDAY) {
        ErrorException(null, "AVAILABILITY.DAY_NOT_ALLOWED", HttpStatus.BAD_REQUEST);
      }
      for (const slot of day.timeSlots || []) {
        if (!slot.endTime || slot.endTime <= slot.startTime) {
          ErrorException(null, "AVAILABILITY.END_BEFORE_START", HttpStatus.BAD_REQUEST);
        }
      }
      if (
        day.useSystemFare === false &&
        (day.amount === undefined || day.amount === null || day.amount <= 0)
      ) {
        ErrorException(null, "AVAILABILITY.AMOUNT_REQUIRED", HttpStatus.BAD_REQUEST);
      }
      return {
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
                amount: this.resolveDayAmount(day, driverVehicleType),
      } as AvailabilityDay;
    });
  }

  /**
   * Resolves the fare amount for a single availability day.
   * - When useSystemFare is true  → computed from MATCHMAKING_CONFIG.SCHEDULED_FARE
   *   using the driver's actual registered vehicle type and the distance between
   *   pickup & dropoff points.
      * - When useSystemFare is false → amount equals the driver's supplied amount.
   */
  private resolveDayAmount(
    day: {
      useSystemFare?: boolean;
            amount?: number | null;
      pickupLocation?: { coordinates?: number[] } | null;
      dropOffLocation?: { coordinates?: number[] } | null;
    },
    driverVehicleType: VehicleType,
  ): number {
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
   * Calculates the system fare using the driver's actual vehicle constant from
   * MATCHMAKING_CONFIG.SCHEDULED_FARE.
   * amount = (basePickupCost + perKm × distanceKm + perMinute × durationMinutes) × multiplier
   */
  private calculateSystemFare(
    vehicle: VehicleType,
    pickup?: { coordinates?: number[] } | null,
    dropoff?: { coordinates?: number[] } | null,
  ): number {
    const config = MATCHMAKING_CONFIG.SCHEDULED_FARE;
    const basePickupCost =
      config.BASE_PICKUP_COST[vehicle] ?? config.BASE_PICKUP_COST.CAR;
    const perKmRate = config.PER_KM_RATE[vehicle] ?? config.PER_KM_RATE.CAR;
    const perMinuteRate =
      config.PER_MINUTE_RATE[vehicle] ?? config.PER_MINUTE_RATE.CAR;
    const multiplier = config.RIDE_TYPE_MULTIPLIER[vehicle] ?? 1;

    const pickupCoords = pickup?.coordinates;
    const dropoffCoords = dropoff?.coordinates;

    let distanceKm = 0;
    let durationMinutes = 0;
    if (pickupCoords?.[1] && dropoffCoords?.[1]) {
      // GeoJSON coordinates are stored as [longitude, latitude].
      distanceKm = this.haversineDistanceKm(
        pickupCoords[1],
        pickupCoords[0],
        dropoffCoords[1],
        dropoffCoords[0],
      );
      durationMinutes = Math.round((distanceKm / ESTIMATED_AVG_SPEED_KMPH) * 60);
    }

    const baseFare =
      basePickupCost + perKmRate * distanceKm + perMinuteRate * durationMinutes;
    return Math.round(baseFare * multiplier);
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

  /** Great-circle distance between two coordinates in kilometres. */
  private haversineDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
