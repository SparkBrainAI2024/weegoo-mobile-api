import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { ErrorException, toMongoId } from "@libs/common";
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
} from "@libs/data-access/entities/availability.entity";
import { AvailabilityRepository } from "@libs/data-access/repositories/availability.repository";

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
    const days = this.toStoredDays(input.days);
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

  private toStoredDays(days: AvailabilityDayInput[]): AvailabilityDay[] {
    return days.map((day) => {
      if (day.day === DayOfWeek.SUNDAY) {
        ErrorException(null, "AVAILABILITY.DAY_NOT_ALLOWED", HttpStatus.BAD_REQUEST);
      }
      for (const slot of day.timeSlots || []) {
        if (!slot.endTime || slot.endTime <= slot.startTime) {
          ErrorException(null, "AVAILABILITY.END_BEFORE_START", HttpStatus.BAD_REQUEST);
        }
      }
      return {
        day: day.day,
        timeSlots: day.timeSlots || [],
        majorStops: day.majorStops || [],
        pickupBufferTimeMinutes: day.pickupBufferTimeMinutes ?? 0,
        pickupLocation: day.pickupLocation || null,
        dropOffLocation: day.dropOffLocation || null,
        notes: day.notes || null,
      } as AvailabilityDay;
    });
  }
}
