import { Injectable } from '@nestjs/common';
import { EnvService } from '@libs/common/config/env.service';

export interface EsewaPaymentPayload {
  amt: number;
  psc: number;
  pdc: number;
  txAmt: number;
  tAmt: number;
  pid: string;
  scd: string;
  su: string;
  fu: string;
}

export interface EsewaVerificationResponse {
  response: {
    response_code: string;
    reference_id: string;
    transaction_id: string;
    total_amount: string;
    status: string;
  }[];
}

@Injectable()
export class EsewaService {
  constructor(private readonly envService: EnvService) {}

  /**
   * Generate the real eSewa payment payload for form-based redirect.
   * Reference: https://developer.esewa.com.np/#eSewa%20Payment%20Integration
   */
  generatePaymentPayload(params: {
    transactionId: string;
    amount: number;
    successUrl: string;
    failureUrl: string;
  }): EsewaPaymentPayload {
    const scd = this.envService.getString('ESEWA_MERCHANT_CODE', 'EPAYTEST');

    return {
      amt: params.amount,
      psc: 0,
      pdc: 0,
      txAmt: 0,
      tAmt: params.amount,
      pid: params.transactionId,
      scd,
      su: params.successUrl,
      fu: params.failureUrl,
    };
  }

  /**
   * Get the eSewa payment gateway URL (test or production based on env).
   */
  getPaymentUrl(): string {
    const isProduction = this.envService.isProduction();
    return isProduction
      ? 'https://esewa.com.np/epay/main'
      : 'https://uat.esewa.com.np/epay/main';
  }

  /**
   * Verify eSewa transaction after successful payment.
   * Calls the eSewa verification API to confirm the payment.
   * Reference: https://developer.esewa.com.np/#verification
   */
  async verifyTransaction(
    referenceId: string,
    totalAmount: number,
  ): Promise<boolean> {
    const scd = this.envService.getString('ESEWA_MERCHANT_CODE', 'EPAYTEST');
    const baseUrl = this.envService.isProduction()
      ? 'https://esewa.com.np'
      : 'https://uat.esewa.com.np';

    const url = `${baseUrl}/epay/transrec`;
    const formData = new URLSearchParams();
    formData.append('scd', scd);
    formData.append('rid', referenceId);
    formData.append('amt', totalAmount.toString());

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        body: formData.toString(),
      });

      const text = await response.text();
      // eSewa returns XML response
      // <response_code>Success</response_code> or <response_code>Failure</response_code>
      return text.includes('<response_code>Success</response_code>');
    } catch (error) {
      return false;
    }
  }
}