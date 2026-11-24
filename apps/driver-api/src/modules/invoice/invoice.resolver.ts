import { Resolver, Query, Args } from "@nestjs/graphql";
import {
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { AuthGuard } from "@libs/guards";
import { CurrentUser } from "@libs/common";
import { User } from "@libs/data-access";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Transaction,
  TransactionDocument,
} from "@libs/data-access/entities/transaction.entity";
import { Rides, RidesDocument } from "@libs/data-access/entities/rides.entity";
import {
  UserDetails,
  UserDetailsDocument,
} from "@libs/data-access/entities/user-details.entity";
import { TransactionType } from "@libs/data-access/enums/transaction.enum";
import { InvoiceService, InvoiceDownloadData } from "@libs/services/invoice/invoice.service";
import {
  InvoiceCreateInput,
  InvoiceCreateResponse,
} from "@libs/data-access/dtos/invoice-create.dto";

@Resolver(() => InvoiceCreateResponse)
export class DriverInvoiceResolver {
  private readonly logger = new Logger(DriverInvoiceResolver.name);

  constructor(
    private readonly invoiceService: InvoiceService,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(UserDetails.name)
    private readonly userDetailsModel: Model<UserDetailsDocument>,
  ) {}

  /**
   * Download an invoice PDF for a transaction.
   *
   * Resolves the ride from the transaction's tripId, gathers the driver and
   * passenger names, pickup/dropoff locations and all commission transactions
   * for that ride, then returns a presigned download URL.
   *
   * The invoice id is `invoice-<transactionId>` and the S3 key is deterministic,
   * so the first request generates the PDF and subsequent requests serve the
   * existing file from S3.
   *
   * When the invoice is requested by the passenger, commission details are
   * hidden from the generated PDF. Drivers see the commission cut-off.
   */
  @Query(() => InvoiceCreateResponse, {
    nullable: true,
    name: "downloadInvoice",
  })
  @UseGuards(AuthGuard)
  async downloadInvoice(
    @CurrentUser() user: User,
    @Args("transactionId") transactionId: string,
  ): Promise<InvoiceCreateResponse | null> {
    // 1. Resolve the transaction
    const transaction = await this.transactionModel.findById(transactionId).exec();
    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }
    if (!transaction.tripId) {
      throw new NotFoundException("Transaction is not linked to a ride");
    }

    // 2. Resolve the ride
    const ride = await this.ridesModel.findById(transaction.tripId).exec();
    if (!ride) {
      throw new NotFoundException("Ride not found");
    }

    // 3. Authorize: only the passenger or the driver of the ride may download
    const userId = user._id.toString();
    const isPassenger = ride.passengerId?.toString() === userId;
    const isDriver = ride.driverId?.toString() === userId;
    if (!isPassenger && !isDriver) {
      throw new ForbiddenException("You are not authorized to download this invoice");
    }

    // 4. Driver and passenger names
    const driverDetails = await this.userDetailsModel
      .findOne({ userId: ride.driverId })
      .exec();
    const passengerDetails = await this.userDetailsModel
      .findOne({ userId: ride.passengerId })
      .exec();
    const driverName = driverDetails?.fullName || "Driver";
    const passengerName = passengerDetails?.fullName || "Passenger";

    // 5. All commission transactions for this ride
    const commissionTransactions = await this.transactionModel
      .find({ tripId: ride._id.toString(), type: TransactionType.COMMISSION })
      .exec();
    const commissionAmount = commissionTransactions.reduce(
      (sum, txn) => sum + Number(txn.amount),
      0,
    );

    // 6. Fare breakdown from the ride
    const totalFare = Number(ride.fare?.totalAmount || 0);
    const baseFare = Number(ride.fare?.baseAmount || 0);
    const distanceCharge = Number(ride.fare?.distanceAmount || 0);
    const discount = Number(ride.fare?.discountAmount || 0);
    const driverEarnings = Number((totalFare - commissionAmount).toFixed(2));

    // 7. Passenger invoices hide commission; driver invoices show it
    const commissionCutOff = isPassenger ? "NO" : "YES";

    // 8. Pickup / dropoff locations
    const fromLocation =
      ride.pickupLocation?.fullAddress ||
      ride.pickupLocation?.address ||
      "N/A";
    const toLocation =
      ride.dropoffLocation?.fullAddress ||
      ride.dropoffLocation?.address ||
      "N/A";

    // 9. Deterministic invoice id and S3 key: invoice-<transactionId>
    const invoiceId = `invoice-${transactionId}`;
    const s3Key = `invoices/${invoiceId}.pdf`;
    const filename = `invoice-${transactionId}.pdf`;

    const invoiceData: InvoiceDownloadData = {
      invoiceId,
      rideUUId: ride.rideUUId || undefined,
      driverName,
      passengerName,
      fromLocation,
      toLocation,
      baseFare,
      distanceCharge,
      discount,
      totalFare,
      commissionAmount,
      driverEarnings,
      commissionCutOff,
      paymentMethod: ride.paymentDetails?.paymentMethod || undefined,
      rideDate: ride.bookingTime ? ride.bookingTime.toISOString() : undefined,
    };

    return this.invoiceService.getOrCreateInvoiceDownload({
      invoiceId,
      s3Key,
      filename,
      data: invoiceData,
    });
  }
}