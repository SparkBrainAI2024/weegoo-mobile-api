import { Injectable } from '@nestjs/common';
import { EnvService } from '@libs/common/config/env.service';

export interface KhaltiPaymentPayload {
  return_url: string;
  website_url: string;
  amount: number;
  purchase_order_id: string;
  purchase_order_name: string;
  public_key: string;
}

export interface KhaltiVerificationResponse {
  status_code: number;
  success: boolean;
  message?: string;
  detail?: {
    amount: number;
    transaction_id: string;
    status: string;
  };
}

@Injectable()
export class KhaltiService {
  constructor(private readonly envService: EnvService) {}

  /**
   * Generate Khalti payment payload for the Khalti Checkout SDK.
   * Reference: https://docs.khalti.com/khalti-ecommerce/
   */
  generatePaymentPayload(params: {
    transactionId: string;
    amount: number;
    returnUrl: string;
    websiteUrl: string;
  }): KhaltiPaymentPayload {
    const publicKey = this.envService.getString('KHALTI_PUBLIC_KEY', 'test_public_key');
    const websiteUrl = params.websiteUrl || this.envService.getString('WEBSITE_URL', 'http://localhost:3000');

    return {
      return_url: params.returnUrl,
      website_url: websiteUrl,
      amount: params.amount * 100, // Khalti expects amount in paisa
      purchase_order_id: params.transactionId,
      purchase_order_name: `Wallet Topup - ${params.transactionId}`,
      public_key: publicKey,
    };
  }

  /**
   * Get the Khalti gateway URL for form-based redirect (fallback).
   */
  getPaymentUrl(params: {
    transactionId: string;
    amount: number;
    returnUrl: string;
  }): string {
    const isProduction = this.envService.isProduction();
    const baseUrl = isProduction
      ? 'https://khalti.com/api/v2/epayment/initiate/'
      : 'https://a.khalti.com/api/v2/epayment/initiate/';
    const secretKey = this.envService.getString('KHALTI_SECRET_KEY', 'test_secret_key');

    // Khalti expects POST with JSON body; this URL is for reference.
    // Frontend should use Khalti Checkout SDK with the payload from generatePaymentPayload.
    return baseUrl;
  }

  /**
   * Verify Khalti transaction using the pidx (payment index).
   * Reference: https://docs.khalti.com/khalti-epayment/#verification
   */
  async verifyTransaction(pidx: string): Promise<{
    success: boolean;
    transactionId?: string;
    amount?: number;
    status?: string;
  }> {
    const secretKey = this.envService.getString('KHALTI_SECRET_KEY', 'test_secret_key');
    const baseUrl = this.envService.isProduction()
      ? 'https://khalti.com/api/v2/epayment/lookup/'
      : 'https://a.khalti.com/api/v2/epayment/lookup/';

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pidx }),
      });

      const data = await response.json();

      if (data.status === 'Completed') {
        return {
          success: true,
          transactionId: data.transaction_id,
          amount: data.total_amount / 100, // Convert back from paisa
          status: data.status,
        };
      }

      return { success: false, status: data.status || 'Failed' };
    } catch (error) {
      return { success: false, status: 'Verification failed' };
    }
  }
}