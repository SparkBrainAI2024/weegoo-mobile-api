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

export function calcPercentChange(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
