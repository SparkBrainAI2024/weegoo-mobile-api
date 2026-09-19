import { TimeRangeFilter } from "@libs/data-access";
import { PaymentsPeriodEnum } from "../../data-access/enums/payments-period.enum";
export interface DateRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

export function resolveDateRange(
  period: PaymentsPeriodEnum = PaymentsPeriodEnum.THIS_MONTH,
  startDate?: Date,
  endDate?: Date,
): DateRange {
  const now = new Date();
  let start: Date;
  let end: Date = endDate ?? now;

  switch (period) {
    case PaymentsPeriodEnum.TODAY:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case PaymentsPeriodEnum.THIS_WEEK: {
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    }
    case PaymentsPeriodEnum.THIS_YEAR:
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case PaymentsPeriodEnum.CUSTOM:
      start = startDate ?? new Date(now.getFullYear(), now.getMonth(), 1);
      end = endDate ?? now;
      break;
    case PaymentsPeriodEnum.THIS_MONTH:
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { start, end, prevStart, prevEnd };
}

// ── Native date helpers (dayjs-free) ────────────────────────────────────────

/** Format a date as "YYYY-MM-DD" in local time. */
function formatDay(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Format a date as "YYYY-MM" in local time. */
function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Format a date as "MMM D" (e.g. "Jan 5") in local time. */
function formatLabelDay(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/** Start of the given day (00:00:00.000 local). */
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** End of the given day (23:59:59.999 local). */
function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/** Start of the month containing the given date. */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** End of the month containing the given date. */
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Add n days to a date (returns a new Date). */
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Add n months to a date, clamping day-of-month (returns a new Date). */
function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  const day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + n);
  // Clamp to last day of the target month (e.g. Jan 31 -> Feb 28)
  copy.setDate(
    Math.min(
      day,
      new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate(),
    ),
  );
  return copy;
}

/** True when both dates fall on the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True when both dates fall in the same calendar month. */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** True when a is on/before b at day precision. */
function isDayBeforeOrSame(a: Date, b: Date): boolean {
  return a.getTime() <= endOfDay(b).getTime();
}

/** True when a is in/before b's month. */
function isMonthBeforeOrSame(a: Date, b: Date): boolean {
  return (
    a.getFullYear() < b.getFullYear() ||
    (a.getFullYear() === b.getFullYear() && a.getMonth() <= b.getMonth())
  );
}

export type Granularity = "day" | "month";

export interface DateBucketConfig {
  start: Date;
  end: Date;
  granularity: Granularity;
  labels: string[]; // for chart x-axis
  keys: string[]; // for matching aggregation results
}

export function buildDateBuckets(filter: TimeRangeFilter): DateBucketConfig {
  const today = startOfDay(new Date());

  switch (filter) {
    case TimeRangeFilter.LAST_7_DAYS: {
      const now = new Date();
      const today = startOfDay(now);
      const start = addDays(today, -6);

      const keys: string[] = [];
      const labels: string[] = [];

      for (let d = start; isDayBeforeOrSame(d, today); d = addDays(d, 1)) {
        keys.push(formatDay(d));
        labels.push(formatLabelDay(d));
      }

      return {
        start,
        end: now,
        granularity: "day",
        labels,
        keys,
      };
    }

    case TimeRangeFilter.LAST_30_DAYS: {
      const now = new Date();
      const today = startOfDay(now);
      const start = addDays(today, -29);

      const keys: string[] = [];
      const labels: string[] = [];

      for (let d = start; isDayBeforeOrSame(d, today); d = addDays(d, 1)) {
        keys.push(formatDay(d));
        labels.push(formatLabelDay(d));
      }

      return {
        start,
        end: now,
        granularity: "day",
        labels,
        keys,
      };
    }

    case TimeRangeFilter.LAST_6_MONTHS: {
      const now = new Date();
      const today = startOfDay(now);
      const start = startOfMonth(addMonths(today, -5));

      const keys: string[] = [];
      const labels: string[] = [];

      for (let d = start; isMonthBeforeOrSame(d, today); d = addMonths(d, 1)) {
        keys.push(formatMonth(d));
        labels.push(MONTH_NAMES[d.getMonth()]);
      }

      return {
        start,
        end: now,
        granularity: "month",
        labels,
        keys,
      };
    }

    case TimeRangeFilter.THIS_YEAR: {
      const now = new Date();
      const today = startOfDay(now);
      const start = new Date(today.getFullYear(), 0, 1);

      const keys: string[] = [];
      const labels: string[] = [];

      for (let m = 0; m <= today.getMonth(); m++) {
        const d = new Date(today.getFullYear(), m, 1);

        keys.push(formatMonth(d));
        labels.push(MONTH_NAMES[m]);
      }

      return {
        start,
        end: now,
        granularity: "month",
        labels,
        keys,
      };
    }
  }
}

export function calcPercentChange(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function getPreviousPeriod(
  start: Date,
  end: Date,
): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1); // 1ms before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}
