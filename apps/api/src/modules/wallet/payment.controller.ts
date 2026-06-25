import { Controller, Post, Query, Body, HttpCode, HttpStatus, Logger, Get } from '@nestjs/common';
import { WalletService } from '@libs/services/payment/src/wallet/wallet.service';
import { PaymentMediumEnum } from '@libs/data-access/enums/payment.enum';

/**
 * REST controller to handle eSewa and Khalti payment callbacks.
 * Gateways redirect users to these URLs after payment processing.
 */
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly walletService: WalletService) {}

  // ── eSewa Callbacks ──────────────────────────────────────────────────

  @Post('esewa/success')
  @HttpCode(HttpStatus.OK)
  async esewaSuccess(
    @Query('transactionId') transactionId: string,
    @Query('refId') refId?: string,
    @Query('oid') oid?: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`eSewa success callback: transactionId=${transactionId}, refId=${refId}, oid=${oid}`);

    if (!transactionId) {
      return { success: false, message: 'Missing transactionId' };
    }

    try {
      // Verify with eSewa server before crediting the wallet
      await this.walletService.completeTopup(transactionId, 0);
      return { success: true, message: 'Topup completed successfully' };
    } catch (error: any) {
      this.logger.error(`eSewa success callback error: ${error.message}`);
      // Mark as failed if verification fails
      try {
        await this.walletService.failTopup(transactionId, error.message);
      } catch (failError: any) {
        this.logger.error(`Failed to mark transaction as failed: ${failError.message}`);
      }
      return { success: false, message: error.message };
    }
  }

  @Post('esewa/failure')
  @HttpCode(HttpStatus.OK)
  async esewaFailure(
    @Query('transactionId') transactionId: string,
    @Body('remarks') remarks?: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`eSewa failure callback: transactionId=${transactionId}, remarks=${remarks}`);

    if (!transactionId) {
      return { success: false, message: 'Missing transactionId' };
    }

    try {
      await this.walletService.failTopup(transactionId, remarks || 'eSewa payment declined by user');
      return { success: true, message: 'Transaction marked as failed' };
    } catch (error: any) {
      this.logger.error(`eSewa failure callback error: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  // ── Khalti Callbacks ─────────────────────────────────────────────────

  @Get('khalti/success')
  @HttpCode(HttpStatus.OK)
  async khaltiSuccess(
    @Query('pidx') pidx: string,
    @Query('status') status: string,
    @Query('transaction_id') transactionId: string,
    @Query('total_amount') totalAmount?: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Khalti success callback: pidx=${pidx}, status=${status}, transactionId=${transactionId}`);

    if (!pidx || !transactionId) {
      return { success: false, message: 'Missing required parameters' };
    }

    try {
      const amount = totalAmount ? parseFloat(totalAmount) / 100 : 0; // Khalti sends amount in paisa
      await this.walletService.completeTopup(transactionId, amount);
      return { success: true, message: 'Topup completed successfully' };
    } catch (error: any) {
      this.logger.error(`Khalti success callback error: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  @Get('khalti/failure')
  @HttpCode(HttpStatus.OK)
  async khaltiFailure(
    @Query('pidx') pidx: string,
    @Query('status') status?: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Khalti failure callback: pidx=${pidx}, status=${status}`);

    if (!pidx) {
      return { success: false, message: 'Missing pidx' };
    }

    try {
      await this.walletService.failTopup(pidx, `Khalti payment failed with status: ${status || 'unknown'}`);
      return { success: true, message: 'Transaction marked as failed' };
    } catch (error: any) {
      this.logger.error(`Khalti failure callback error: ${error.message}`);
      return { success: false, message: error.message };
    }
  }
}