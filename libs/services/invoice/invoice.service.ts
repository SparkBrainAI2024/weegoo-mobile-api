import { Injectable, Logger } from "@nestjs/common";
import { S3Service } from "@libs/s3";
import { SendGridMailService } from "@libs/services/mail";
import { generateNanoId } from "@libs/common";
import { InvoiceCreateInput, InvoiceCreateResponse } from "@libs/data-access/dtos/invoice-create.dto";
import { InvoiceCommissionCutOff } from "@libs/data-access/enums/invoice.enum";

export type InvoiceRecipientType = "passenger" | "driver";

/**
 * Input data used to render the downloadable invoice.
 */
export interface InvoiceDownloadData {
  invoiceId: string;
  rideUUId?: string | null;
  driverName: string;
  passengerName: string;
  fromLocation: string;
  toLocation: string;
  baseFare: number;
  distanceCharge: number;
  discount: number;
  totalFare: number;
  commissionAmount: number;
  driverEarnings: number;
  commissionCutOff: string; // "YES" | "NO"
  paymentMethod?: string | null;
  rideDate?: string | null;
  invoiceType?: InvoiceRecipientType;
  recipientEmail?: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly sendGridMailService: SendGridMailService,
  ) {}

  async createInvoice(createInput: InvoiceCreateInput): Promise<InvoiceCreateResponse> {
    const { fromAmount, toAmount, commissionCutOff, commissionLocation, fromLocation, toLocation, userEmail } = createInput;

    // Generate invoice ID
    const invoiceId = `invoice-${generateNanoId()}`;

    // Generate S3 key for the invoice file
    const s3Key = `invoices/${invoiceId}/invoice-${generateNanoId()}.pdf`;

    // Build invoice content
    const invoiceContent = this.buildInvoiceContent({
      fromAmount,
      toAmount,
      commissionCutOff,
      commissionLocation,
      fromLocation,
      toLocation,
    });

    // Save to S3 (first time download prepares the file)
    await this.s3Service.uploadObject(s3Key, invoiceContent, "application/pdf");

    // Generate presigned download URL with 1 month expiry (30 days)
    const expiresInSeconds = 30 * 24 * 60 * 60; // 30 days
    const downloadUrl = await this.s3Service.getDownloadUrl(s3Key, expiresInSeconds, `invoice-${invoiceId}.pdf`);

    // Send email with download link
    await this.sendInvoiceEmail(userEmail, downloadUrl, invoiceId);

    return {
      downloadLink: downloadUrl,
      invoiceId,
    };
  }

  /**
   * Returns a presigned download URL for an invoice PDF.
   *
   * The S3 key is deterministic (`invoices/invoice-<transactionId>.pdf`), so the
   * same transaction always resolves to the same file. When the file already
   * exists in S3 it is served directly; otherwise the invoice is generated,
   * uploaded to S3, and its presigned URL is returned.
   */
  async getOrCreateInvoiceDownload(params: {
    invoiceId: string;
    s3Key: string;
    filename: string;
    data: InvoiceDownloadData;
  }): Promise<{ downloadLink: string; invoiceId: string }> {
    const expiresInSeconds = 30 * 24 * 60 * 60; // 30 days

    const alreadyExists = await this.s3Service.objectExists(params.s3Key);
    let downloadUrl: string;
    if (alreadyExists) {
      this.logger.log(`Serving existing invoice from S3: ${params.s3Key}`);
      downloadUrl = await this.s3Service.getDownloadUrl(
        params.s3Key,
        expiresInSeconds,
        params.filename,
      );
    } else {
      this.logger.log(`Generating new invoice to S3: ${params.s3Key}`);
      const content = this.buildDownloadInvoiceContent(params.data);
      await this.s3Service.uploadObject(params.s3Key, content, "application/pdf");
      downloadUrl = await this.s3Service.getDownloadUrl(
        params.s3Key,
        expiresInSeconds,
        params.filename,
      );
    }

    return {
      downloadLink: downloadUrl,
      invoiceId: params.invoiceId,
    };
  }

  /**
   * Sends scheduled-ride invoices to both driver and passenger in the
   * background (fire-and-forget, not awaited by the caller).
   *
   * Passenger invoice: full fare breakdown, commission hidden.
   * Driver invoice: only the platform commission cut-off is shown.
   *
   * The S3 key is deterministic per transaction (`invoices/invoice-<txnId>.pdf`),
   * so if the file already exists it is served directly; otherwise it is
   * generated and uploaded first.
   */
  sendScheduledRideInvoiceEmails(params: {
    ride: any;
    passengerTransactionId: string;
    driverTransactionId: string;
    passengerEmail: string;
    driverEmail: string;
    passengerName: string;
    driverName: string;
    baseFare: number;
    distanceCharge: number;
    discount: number;
    totalFare: number;
    commissionAmount: number;
    driverEarnings: number;
    paymentMethod?: string | null;
  }): void {
    this.sendScheduledRideInvoiceEmailsInternal(params).catch((err) => {
      this.logger.error(
        "Failed to send scheduled-ride invoice emails",
        err?.stack || err,
      );
    });
  }

  private async sendScheduledRideInvoiceEmailsInternal(params: {
    ride: any;
    passengerTransactionId: string;
    driverTransactionId: string;
    passengerEmail: string;
    driverEmail: string;
    passengerName: string;
    driverName: string;
    baseFare: number;
    distanceCharge: number;
    discount: number;
    totalFare: number;
    commissionAmount: number;
    driverEarnings: number;
    paymentMethod?: string | null;
  }): Promise<void> {
    const rideDate = params.ride.bookingTime
      ? params.ride.bookingTime.toISOString()
      : undefined;
    const fromLocation =
      params.ride.pickupLocation?.fullAddress ||
      params.ride.pickupLocation?.address ||
      "N/A";
    const toLocation =
      params.ride.dropoffLocation?.fullAddress ||
      params.ride.dropoffLocation?.address ||
      "N/A";

    // ── Passenger invoice (commission hidden) ─────────────────────────
    const passengerInvoice = await this.getOrCreateInvoiceDownload({
      invoiceId: `invoice-${params.passengerTransactionId}`,
      s3Key: `invoices/invoice-${params.passengerTransactionId}.pdf`,
      filename: `invoice-${params.passengerTransactionId}.pdf`,
      data: {
        invoiceId: `invoice-${params.passengerTransactionId}`,
        rideUUId: params.ride.rideUUId || undefined,
        driverName: params.driverName,
        passengerName: params.passengerName,
        fromLocation,
        toLocation,
        baseFare: params.baseFare,
        distanceCharge: params.distanceCharge,
        discount: params.discount,
        totalFare: params.totalFare,
        commissionAmount: params.commissionAmount,
        driverEarnings: params.driverEarnings,
        commissionCutOff: InvoiceCommissionCutOff.NO,
        paymentMethod: params.paymentMethod || undefined,
        rideDate,
        invoiceType: "passenger",
        recipientEmail: params.passengerEmail,
      },
    });

    // ── Driver invoice (commission cut-off only) ──────────────────────
    const driverInvoice = await this.getOrCreateInvoiceDownload({
      invoiceId: `invoice-${params.driverTransactionId}`,
      s3Key: `invoices/invoice-${params.driverTransactionId}.pdf`,
      filename: `invoice-${params.driverTransactionId}.pdf`,
      data: {
        invoiceId: `invoice-${params.driverTransactionId}`,
        rideUUId: params.ride.rideUUId || undefined,
        driverName: params.driverName,
        passengerName: params.passengerName,
        fromLocation,
        toLocation,
        baseFare: 0,
        distanceCharge: 0,
        discount: 0,
        totalFare: params.commissionAmount,
        commissionAmount: params.commissionAmount,
        driverEarnings: 0,
        commissionCutOff: InvoiceCommissionCutOff.YES,
        paymentMethod: params.paymentMethod || undefined,
        rideDate,
        invoiceType: "driver",
        recipientEmail: params.driverEmail,
      },
    });

    // ── Send both emails ─────────────────────────────────────────────
    await this.sendInvoiceEmail(
      params.passengerEmail,
      passengerInvoice.downloadLink,
      passengerInvoice.invoiceId,
      "passenger",
    );
    await this.sendInvoiceEmail(
      params.driverEmail,
      driverInvoice.downloadLink,
      driverInvoice.invoiceId,
      "driver",
    );
  }

  private buildDownloadInvoiceContent(data: InvoiceDownloadData): string {
    const showCommission = data.commissionCutOff === InvoiceCommissionCutOff.YES;
    const isDriver = data.invoiceType === "driver";

    // Driver invoice shows ONLY the commission cut-off line item.
    const commissionRow = isDriver
      ? `<tr><td>Platform Commission Cut-off</td><td>${data.commissionAmount.toFixed(2)}</td></tr>`
      : showCommission
        ? `<tr><td>Platform Commission</td><td>${data.commissionAmount.toFixed(2)}</td></tr>`
        : `<tr><td>Platform Commission</td><td>Not shown (passenger invoice)</td></tr>`;

    const commissionNote = showCommission && !isDriver
      ? ""
      : `<p style="color:#dc2626;font-size:13px;margin-top:8px;">Commission details are not displayed for passenger invoices.</p>`;

    // Fare rows: driver invoice shows only commission; passenger shows full breakdown.
    const fareRows = isDriver
      ? ``
      : `
      <tr><td>Base Fare</td><td>${data.baseFare.toFixed(2)}</td></tr>
      <tr><td>Distance Charge</td><td>${data.distanceCharge.toFixed(2)}</td></tr>
      <tr><td>Discount</td><td>${data.discount.toFixed(2)}</td></tr>
      <tr><td>Total Fare</td><td>${data.totalFare.toFixed(2)}</td></tr>
      ${commissionRow}
      <tr><td>Driver Earnings</td><td>${data.driverEarnings.toFixed(2)}</td></tr>
    `;

    const totalLabel = isDriver ? "Commission Payable to Platform" : "Amount Payable";
    const totalValue = isDriver ? data.commissionAmount : data.totalFare;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${data.invoiceId}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #222; padding: 24px; line-height: 1.5; }
  .invoice { max-width: 720px; margin: 0 auto; border: 1px solid #d1d5db; border-radius: 10px; padding: 32px; }
  .header { text-align: center; margin-bottom: 26px; }
  .header h1 { margin: 0 0 8px 0; color: #2563eb; font-size: 26px; }
  .header p { margin: 2px 0; color: #6b7280; font-size: 13px; }
  .meta { display: flex; gap: 24px; margin-bottom: 22px; font-size: 13px; color: #6b7280; }
  .meta div { flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  th { color: #2563eb; font-weight: 700; width: 42%; }
  .total { font-size: 18px; font-weight: 800; color: #2563eb; margin-top: 14px; }
  .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <h1>Invoice</h1>
      <p><strong>Invoice ID:</strong> ${data.invoiceId}</p>
      <p><strong>Ride ID:</strong> ${data.rideUUId || "N/A"}</p>
      <p><strong>Date:</strong> ${data.rideDate || "N/A"}</p>
    </div>
    <div class="meta">
      <div><strong>From (Driver):</strong> ${data.driverName}</div>
      <div><strong>To (Passenger):</strong> ${data.passengerName}</div>
    </div>
    <table>
      <tr><th>Pickup (From)</th><td>${data.fromLocation}</td></tr>
      <tr><th>Dropoff (To)</th><td>${data.toLocation}</td></tr>
      <tr><th>Payment Method</th><td>${data.paymentMethod || "N/A"}</td></tr>
    </table>
    ${isDriver ? `<table>${commissionRow}</table>` : `<table><tr><th>Item</th><th>Amount</th></tr>${fareRows}</table>`}
    <div class="total">${totalLabel}: ${totalValue.toFixed(2)}</div>
    ${commissionNote}
    <div class="footer">
      Generated for ride ${data.rideUUId || ""} &bull; Invoice ID: ${data.invoiceId}.<br>
      This invoice is valid for 30 days from the date of generation.
    </div>
  </div>
</body>
</html>`;
  }

  private buildInvoiceContent(data: {
    fromAmount: number;
    toAmount: number;
    commissionCutOff: string;
    commissionLocation: string;
    fromLocation: string;
    toLocation: string;
  }): string {
    // Create a simple HTML invoice content that will be converted to PDF
    const commissionCutOffLabel = data.commissionCutOff === InvoiceCommissionCutOff.YES ? "Yes" : "No";
    const commissionLocationLabel = data.commissionLocation || "N/A";
    const fromLocationLabel = data.fromLocation || "N/A";
    const toLocationLabel = data.toLocation || "N/A";

    return `
      <h1>Invoice</h1>
      <p><strong>From Amount:</strong> ${data.fromAmount}</p>
      <p><strong>To Amount:</strong> ${data.toAmount}</p>
      <p><strong>Commission Cut Off:</strong> ${commissionCutOffLabel}</p>
      <p><strong>Commission Location:</strong> ${commissionLocationLabel}</p>
      <p><strong>From Location:</strong> ${fromLocationLabel}</p>
      <p><strong>To Location:</strong> ${toLocationLabel}</p>
      <p>This invoice is valid for 30 days from the date of generation.</p>
    `;
  }

  private async sendInvoiceEmail(
    userEmail: string,
    downloadUrl: string,
    invoiceId: string,
    recipientType: "passenger" | "driver" = "passenger",
  ): Promise<void> {
    const isDriver = recipientType === "driver";
    const subject = isDriver
      ? `Your Ride Invoice - Commission Cut-off (${invoiceId})`
      : `Your Ride Invoice (${invoiceId})`;
    const htmlContent = `
      <h2>Ride Invoice</h2>
      <p>Hello,</p>
      <p>Your scheduled ride invoice is ready for download.</p>
      <p><strong>Invoice ID:</strong> ${invoiceId}</p>
      <p><strong>Invoice Type:</strong> ${isDriver ? "Driver (Commission Cut-off Only)" : "Passenger"}</p>
      <p><a href="${downloadUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Download Invoice PDF</a></p>
      <p>The download link will expire in 30 days.</p>
      <p>If the file was already generated, this link serves the existing S3 file directly.</p>
    `;

    await this.sendGridMailService.sendRawEmail({
      to: userEmail,
      subject,
      html: htmlContent,
    });

    this.logger.log(`Invoice email sent to ${userEmail} (${recipientType}) for invoice ${invoiceId}`);
  }
}