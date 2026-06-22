import { Controller, Post, Query, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { WalletService } from '@libs/services/payment/src/wallet/wallet.service';

/**
 * REST controller to handle eSewa payment callbacks.
 * eSewa redirects users to these URLs after payment processing.
 */
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly walletService: WalletService) {}

  /**
   * POST /payment/esewa/success
   * Called by eSewa or the frontend after successful payment.
   * Query params: transactionId, refId (eSewa reference), oid (order ID from eSewa)
   */
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
      // In production, verify the payment with eSewa server API here
      // using refId and oid before crediting the wallet
      const verifiedAmount = 0; // Extract from eSewa response
      await this.walletService.completeTopup(transactionId, verifiedAmount);
      return { success: true, message: 'Topup completed successfully' };
    } catch (error: any) {
      this.logger.error(`eSewa success callback error: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * POST /payment/esewa/failure
   * Called by eSewa or the frontend after failed payment.
   * Query params: transactionId
   */
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
}