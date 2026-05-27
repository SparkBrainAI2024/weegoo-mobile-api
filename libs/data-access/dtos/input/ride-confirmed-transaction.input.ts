import { PaymentMethodEnum } from "@libs/data-access/enums/payment.enum";

export interface RideConfirmedInput {
  tripId: string;
  //TODO riderWalletId: string;
  // driverWalletId: string;
  // adminWalletId: string;
  riderId: string;
  driverId: string;
  adminId: string;
  totalFare: number;
  commission: number;
  paymentMethod?: PaymentMethodEnum;
}