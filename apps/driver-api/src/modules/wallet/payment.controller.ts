import { Controller, Post, Query, Body, HttpCode, HttpStatus, Logger, Get, Res } from '@nestjs/common';
import { WalletService } from '@libs/services/payment/src/wallet/wallet.service';
import { Response } from 'express';

/**
 * REST controller to handle eSewa and Khalti payment callbacks.
 * Gateways redirect users to these URLs after payment processing.
 *
 * IMPORTANT: eSewa redirects via GET (not POST), while Khalti redirects via GET.
 * All callback endpoints use @Get with query parameters.
 */
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly walletService: WalletService) {}

  // ── eSewa Callbacks ──────────────────────────────────────────────────
  //
  // eSewa redirects the user to the success/failure URL via GET with query params:
  //   ?transactionId=xxx&refId=yyy&oid=zzz (success)
  //   ?transactionId=xxx                  (failure)
  //

  @Get('esewa/success')
  @HttpCode(HttpStatus.OK)
  async esewaSuccess(
    @Query('transactionId') transactionId: string,
    @Query('refId') refId?: string,
    @Query('oid') oid?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
    this.logger.log(`eSewa success callback: transactionId=${transactionId}, refId=${refId}, oid=${oid}`);

    if (!transactionId) {
      return { success: false, message: 'Missing transactionId', redirectUrl: this.getRedirectUrl('failure') };
    }

    try {
      await this.walletService.completeTopup(transactionId, 0, { refId });
      return {
        success: true,
        message: 'Topup completed successfully',
        redirectUrl: this.getRedirectUrl('success'),
      };
    } catch (error: any) {
      this.logger.error(`eSewa success callback error: ${error.message}`);
      try {
        await this.walletService.failTopup(transactionId, error.message);
      } catch (failError: any) {
        this.logger.error(`Failed to mark transaction as failed: ${failError.message}`);
      }
      return {
        success: false,
        message: error.message,
        redirectUrl: this.getRedirectUrl('failure'),
      };
    }
  }

  @Get('esewa/failure')
  @HttpCode(HttpStatus.OK)
  async esewaFailure(
    @Query('transactionId') transactionId: string,
    @Query('remarks') remarks?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
    this.logger.log(`eSewa failure callback: transactionId=${transactionId}, remarks=${remarks}`);

    if (!transactionId) {
      return { success: false, message: 'Missing transactionId', redirectUrl: this.getRedirectUrl('failure') };
    }

    try {
      await this.walletService.failTopup(transactionId, remarks || 'eSewa payment declined by user');
      return {
        success: true,
        message: 'Transaction marked as failed',
        redirectUrl: this.getRedirectUrl('failure'),
      };
    } catch (error: any) {
      this.logger.error(`eSewa failure callback error: ${error.message}`);
      return {
        success: false,
        message: error.message,
        redirectUrl: this.getRedirectUrl('failure'),
      };
    }
  }

  // ── Khalti Callbacks ─────────────────────────────────────────────────
  //
  // Khalti redirects the user to the return_url via GET with query params:
  //   ?pidx=xxx&status=Completed&transaction_id=yyy&total_amount=zzz (success)
  //   ?pidx=xxx&status=User+Cancelled                                   (failure)
  //

  @Get('khalti/success')
  @HttpCode(HttpStatus.OK)
  async khaltiSuccess(
    @Query('pidx') pidx: string,
    @Query('status') status: string,
    @Query('transaction_id') transactionId: string,
    @Query('total_amount') totalAmount?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
    this.logger.log(`Khalti success callback: pidx=${pidx}, status=${status}, transactionId=${transactionId}`);

    if (!pidx) {
      return { success: false, message: 'Missing pidx', redirectUrl: this.getRedirectUrl('failure') };
    }

    try {
      // Use pidx to look up / verify the transaction on Khalti's server
      const lookupResult = await this.walletService.completeTopupWithKhalti(pidx, transactionId);
      if (lookupResult.success) {
        return {
          success: true,
          message: 'Topup completed successfully',
          redirectUrl: this.getRedirectUrl('success'),
        };
      }
      return {
        success: false,
        message: lookupResult.message || 'Khalti verification failed',
        redirectUrl: this.getRedirectUrl('failure'),
      };
    } catch (error: any) {
      this.logger.error(`Khalti success callback error: ${error.message}`);
      return {
        success: false,
        message: error.message,
        redirectUrl: this.getRedirectUrl('failure'),
      };
    }
  }

  @Get('khalti/failure')
  @HttpCode(HttpStatus.OK)
  async khaltiFailure(
    @Query('pidx') pidx: string,
    @Query('status') status?: string,
    @Query('transaction_id') transactionId?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
    this.logger.log(`Khalti failure callback: pidx=${pidx}, status=${status}, transactionId=${transactionId}`);

    if (!pidx && !transactionId) {
      return { success: false, message: 'Missing pidx or transactionId', redirectUrl: this.getRedirectUrl('failure') };
    }

    const txnId = transactionId || pidx;
    try {
      await this.walletService.failTopup(txnId, `Khalti payment failed with status: ${status || 'unknown'}`);
      return {
        success: true,
        message: 'Transaction marked as failed',
        redirectUrl: this.getRedirectUrl('failure'),
      };
    } catch (error: any) {
      this.logger.error(`Khalti failure callback error: ${error.message}`);
      return {
        success: false,
        message: error.message,
        redirectUrl: this.getRedirectUrl('failure'),
      };
    }
  }

  /**
   * Get the frontend redirect URL for success/failure.
   * Driver payments redirect to the driver-facing frontend.
   */
  private getRedirectUrl(type: 'success' | 'failure'): string {
    const baseAPI = process.env.API_BASE_URL;
    return type === 'success'
      ? `${baseAPI}/payment/esewa/success`
      : `${baseAPI}/payment/esewa/failure`;
  }
}