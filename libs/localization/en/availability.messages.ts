export const AVAILABILITY = {
  DAYS_REQUIRED: "At least one availability day is required.",
  TIME_SLOT_START_REQUIRED: "Time slot start time is required.",
  TIME_SLOT_END_REQUIRED: "Time slot end time is required.",
  MAJOR_STOP_LABEL_REQUIRED: "Major stop label is required.",
  INVALID_DAY: "Invalid availability day provided.",
  DAY_NOT_ALLOWED:
    "Availability can only be set for days of the current week that have not passed yet.",
  WEEK_START_ON_SUNDAY_ONLY:
    "Weekly availability can only be created/updated on a Sunday for the upcoming week.",
  WEEK_NOT_FOUND: "No availability found for the requested week.",
  DAY_NOT_FOUND: "No availability found for the requested day.",
  AVAILABILITY_ADDED: "Weekly availability has been added successfully.",
  AVAILABILITY_UPDATED: "Availability updated successfully.",
  AVAILABILITY_REMOVED: "Availability removed successfully.",
  PAST_AVAILABILITY_DELETED:
    "All past availability days have been deleted successfully.",
  END_BEFORE_START: "Time slot end time must be after the start time.",
  INVALID_VEHICLE_TYPE: "Invalid scheduled vehicle type. Allowed values are JEEP, MICRO, and CAR.",
    AMOUNT_REQUIRED: "An amount must be provided when the system fare is not used.",
  AMOUNT_MUST_BE_POSITIVE:
    "Amount must be greater than zero when the system fare is not used.",
    SUNDAY_NOT_PAST:
    "Availability for a past Sunday cannot be added/updated — the day has already passed.",
  PAST_DATE_NOT_ALLOWED:
    "Cannot add or update availability for a date that has already passed.",
  ONLY_CURRENT_WEEK_ALLOWED:
    "Availability can only be added or updated for today up to 6 days from today.",
  MAX_DAYS_REACHED:
    "Availability can be set for a maximum of 6 days.",
  ONE_DAY_AT_A_TIME:
    "Availability can only be added for one day at a time.",
  DUPLICATE_DAY:
    "Availability for this day has already been added. Use the edit option to update it.",
  TIME_SLOT_INVALID: "Time slot start time must be a valid date and time.",
  TIME_SLOT_PAST: "Time slot start time has already passed. Please choose a future time slot.",
  ONE_WAY_ONE_SLOT:
    "A one-way trip must have exactly one time slot.",
  ROUND_TRIP_TWO_SLOTS:
    "A round trip must have exactly two time slots.",
  TIME_SLOT_DUPLICATE:
    "Time slot start times must not be the same.",
  TIME_SLOT_MIN_GAP:
    "There must be at least 3 hours between time slot start times.",
  TIME_SLOT_DAY_MISMATCH:
    "The day of the time slot start time does not match the availability day it belongs to.",
  MAJOR_STOPS_MAX: "A maximum of 5 major stops is allowed.",
};