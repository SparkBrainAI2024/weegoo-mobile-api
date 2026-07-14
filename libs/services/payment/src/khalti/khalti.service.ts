import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '@libs/common/config/env.service';

export interface KhaltiPaymentPayload {
  /** Return URL after payment */
  return_url: string;
  /** Website URL */
  website_url: string;
  /** Amount in paisa (NPR * 100) */
  amount: number;
  /** Purchase Order ID (your transaction ID) */
  purchase_order_id: string;
  /** Purchase Order Name (e.g. "Wallet Topup - TXN123") */
  purchase_order_name: string;
  /** Khalti public key for the checkout SDK */
  public_key: string;
}

export interface KhaltiInitiateResponse {
  pidx: string;
  payment_url: string;
  expires_at: string;
  expires_in: number;
  user_fee: number;
}

export interface KhaltiSdkPayload {
  /** The payment URL to redirect the user to (for web redirect) */
  paymentUrl: string;
  /** The pidx (payment index) for verification */
  pidx: string;
  /** Payload for Khalti Checkout SDK (mobile/web) */
  sdkPayload: KhaltiPaymentPayload;
  /** Whether to use SDK or redirect */
  useSdk: boolean;
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

export interface KhaltiLookupResponse {
  pidx: string;
  total_amount: number;
  status: string;
  transaction_id: string;
  fee: number;
  refunded: boolean;
}

@Injectable()
export class KhaltiService {
  private readonly logger = new Logger(KhaltiService.name);

  constructor(private readonly envService: EnvService) {}

  /**
   * Generate Khalti payment payload for the Khalti Checkout SDK.
   * The frontend uses this payload to initialize Khalti Checkout.
   *
   * Reference: https://docs.khalti.com/khalti-epayment/
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
   * Initiate Khalti EPayment - this is a server-to-server call to create a payment session.
   * Returns the pidx and payment_url that can be used to redirect the user.
   *
   * This MUST be called from the backend to get a valid pidx.
   * Reference: https://docs.khalti.com/khalti-epayment/#initiating-payment
   */
  async initiatePayment(params: {
    transactionId: string;
    amount: number;
    returnUrl: string;
    websiteUrl?: string;
    purchaseOrderName?: string;
  }): Promise<KhaltiSdkPayload> {
    const secretKey = this.envService.getString('KHALTI_SECRET_KEY', 'test_secret_key');
    const publicKey = this.envService.getString('KHALTI_PUBLIC_KEY', 'test_public_key');
    const websiteUrl = params.websiteUrl || this.envService.getString('WEBSITE_URL', 'http://localhost:3000');
    const isProduction = this.envService.isProduction();
    const initiateUrl = isProduction
      ? 'https://khalti.com/api/v2/epayment/initiate/'
      : 'https://a.khalti.com/api/v2/epayment/initiate/';

    const sdkPayload: KhaltiPaymentPayload = {
      return_url: params.returnUrl,
      website_url: websiteUrl,
      amount: params.amount * 100, // Convert to paisa
      purchase_order_id: params.transactionId,
      purchase_order_name: params.purchaseOrderName || `Wallet Topup - ${params.transactionId}`,
      public_key: publicKey,
    };

    try {
      const response = await fetch(initiateUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: params.returnUrl,
          website_url: websiteUrl,
          amount: params.amount * 100,
          purchase_order_id: params.transactionId,
          purchase_order_name: params.purchaseOrderName || `Wallet Topup - ${params.transactionId}`,
        }),
      });

      const data = await response.json();

      if (data.pidx && data.payment_url) {
        return {
          paymentUrl: data.payment_url,
          pidx: data.pidx,
          sdkPayload,
          useSdk: false, // Prefer redirect to Khalti's hosted page
        };
      }

      // Fallback: return SDK payload for Khalti Checkout
      const baseUrl = isProduction
        ? 'https://khalti.com/api/v2/epayment/initiate/'
        : 'https://a.khalti.com/api/v2/epayment/initiate/';

      return {
        paymentUrl: baseUrl,
        pidx: '',
        sdkPayload,
        useSdk: true,
      };
    } catch (error) {
      this.logger.error('Khalti initiation error:', error);
      // Fallback to SDK-based checkout
      return {
        paymentUrl: '',
        pidx: '',
        sdkPayload,
        useSdk: true,
      };
    }
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

    return baseUrl;
  }

  /**
   * Lookup / Verify Khalti transaction using the pidx (payment index).
   * This is the recommended verification method by Khalti.
   * Reference: https://docs.khalti.com/khalti-epayment/#verification
   */
  async lookupTransaction(pidx: string): Promise<{
    success: boolean;
    transactionId?: string;
    amount?: number;
    status?: string;
    pidx?: string;
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

      const data: KhaltiLookupResponse = await response.json();

      if (data.status === 'Completed') {
        return {
          success: true,
          transactionId: data.transaction_id,
          amount: data.total_amount / 100, // Convert back from paisa
          status: data.status,
          pidx: data.pidx,
        };
      }

      if (data.status === 'Pending') {
        return { success: false, status: 'Pending' };
      }

      if (data.status === 'Initiated') {
        return { success: false, status: 'Initiated' };
      }

      return { success: false, status: data.status || 'Failed' };
    } catch (error) {
      this.logger.error('Khalti lookup error:', error);
      return { success: false, status: 'Verification failed' };
    }
  }

  /**
   * Verify Khalti transaction (legacy method - uses the same lookup endpoint).
   * Kept for backward compatibility.
   */
  async verifyTransaction(pidx: string): Promise<{
    success: boolean;
    transactionId?: string;
    amount?: number;
    status?: string;
  }> {
    return this.lookupTransaction(pidx);
  }
}