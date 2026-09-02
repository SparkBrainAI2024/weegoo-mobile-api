import { TimeRangeFilter } from "@libs/data-access";
import { PaymentsPeriodEnum } from "../../data-access/enums/payments-period.enum";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
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

dayjs.extend(isSameOrBefore);

export type Granularity = "day" | "month";

export interface DateBucketConfig {
  start: Date;
  end: Date;
  granularity: Granularity;
  labels: string[]; // for chart x-axis
  keys: string[]; // for matching aggregation results
}

export function buildDateBuckets(filter: TimeRangeFilter): DateBucketConfig {
  const today = dayjs().startOf("day");

  switch (filter) {
    case TimeRangeFilter.LAST_7_DAYS: {
      const end = today.subtract(1, "day");
      const start = end.subtract(6, "day");
      const keys: string[] = [],
        labels: string[] = [];
      for (let d = start; d.isSameOrBefore(end, "day"); d = d.add(1, "day")) {
        keys.push(d.format("YYYY-MM-DD"));
        labels.push(d.format("MMM D"));
      }
      return {
        start: start.toDate(),
        end: end.endOf("day").toDate(),
        granularity: "day",
        labels,
        keys,
      };
    }

    case TimeRangeFilter.LAST_MONTH: {
      const start = today.subtract(1, "month").startOf("month");
      const end = today.subtract(1, "month").endOf("month");
      const keys: string[] = [],
        labels: string[] = [];
      for (let d = start; d.isSameOrBefore(end, "day"); d = d.add(1, "day")) {
        keys.push(d.format("YYYY-MM-DD"));
        labels.push(d.format("MMM D"));
      }
      return {
        start: start.toDate(),
        end: end.toDate(),
        granularity: "day",
        labels,
        keys,
      };
    }

    case TimeRangeFilter.LAST_6_MONTHS: {
      const start = today.subtract(5, "month").startOf("month");
      const end = today.endOf("month");
      const keys: string[] = [],
        labels: string[] = [];
      for (
        let d = start;
        d.isSameOrBefore(end, "month");
        d = d.add(1, "month")
      ) {
        keys.push(d.format("YYYY-MM"));
        labels.push(d.format("MMM"));
      }
      return {
        start: start.toDate(),
        end: end.toDate(),
        granularity: "month",
        labels,
        keys,
      };
    }

    case TimeRangeFilter.THIS_YEAR: {
      const start = today.startOf("year");
      const keys: string[] = [],
        labels: string[] = [];
      for (let m = 0; m < 12; m++) {
        const d = start.month(m);
        keys.push(d.format("YYYY-MM"));
        labels.push(d.format("MMM"));
      }
      return {
        start: start.toDate(),
        end: start.endOf("year").toDate(),
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
