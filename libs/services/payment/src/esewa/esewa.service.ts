import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '@libs/common/config/env.service';
import * as crypto from 'crypto';

export interface EsewaPaymentPayload {
  /** Amount to be paid (in NPR) */
  amt: number;
  /** Service charge (usually 0) */
  psc: number;
  /** Delivery charge (usually 0) */
  pdc: number;
  /** Tax amount (usually 0) */
  txAmt: number;
  /** Total amount = amt + psc + pdc + txAmt */
  tAmt: number;
  /** Product ID / Transaction UUID (our internal unique identifier) */
  pid: string;
  /** Merchant Code / Service Code */
  scd: string;
  /** Success URL - eSewa redirects here after successful payment */
  su: string;
  /** Failure URL - eSewa redirects here after failed payment */
  fu: string;
}

export interface EsewaSdkPayload {
  /** The payment URL to redirect the user to */
  paymentUrl: string;
  /** Form fields to POST to the payment URL */
  formFields: EsewaPaymentPayload;
  /** Epay-v2 signature (if secret key is configured) */
  signature?: string;
  /** Signed fields for Epay-v2 */
  signedFields?: string;
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

export interface EsewaStatusResponse {
  status: string;
  total_amount?: number;
  transaction_id?: string;
}

@Injectable()
export class EsewaService {
  private readonly logger = new Logger(EsewaService.name);

  constructor(private readonly envService: EnvService) {}

  /**
   * Get the base URL for eSewa endpoints based on environment.
   */
  private getBaseUrl(): string {
    return this.envService.isProduction()
      ? 'https://esewa.com.np'
      : 'https://rc-epay.esewa.com.np';
  }

  /**
   * Generate the real eSewa payment payload for form-based redirect.
   * Supports both old Epay and new Epay-v2 (with HMAC-SHA256 signature).
   *
   * eSewa Flow (Old Epay - most common):
   * 1. Merchant posts form to eSewa with: amt, psc, pdc, txAmt, tAmt, pid, scd, su, fu
   * 2. User logs into eSewa and confirms payment
   * 3. eSewa redirects to su (success URL) with: refId, oid, transactionId
   *    OR to fu (failure URL) with: transactionId
   * 4. Merchant verifies via POST to /epay/transrec with: scd, rid (refId), amt
   *
   * Reference: https://developer.esewa.com.np
   */
  generatePaymentPayload(params: {
    transactionId: string;
    amount: number;
    successUrl: string;
    failureUrl: string;
  }): EsewaSdkPayload {
    const scd = this.envService.getString('ESEWA_MERCHANT_CODE', 'EPAYTEST');
    const secretKey = this.envService.getString('ESEWA_SECRET_KEY', '');
    const baseUrl = this.getBaseUrl() + '/api/epay/main/v2/form';

    const formFields: EsewaPaymentPayload = {
      amt: params.amount,
      psc: 0,
      pdc: 0,
      txAmt: 0,
      tAmt: params.amount,
      pid: params.transactionId, // Our transaction UUID, returned as oid by eSewa
      scd,
      su: params.successUrl,
      fu: params.failureUrl,
    };

    const sdkPayload: EsewaSdkPayload = {
      paymentUrl: baseUrl,
      formFields,
    };

    // If secret key is configured, generate Epay-v2 signature
    if (secretKey) {
      const message = `total_amount=${params.amount},transaction_uuid=${params.transactionId},product_code=${scd}`;
      sdkPayload.signature = this.generateHmacSha256(message, secretKey);
      sdkPayload.signedFields = 'total_amount,transaction_uuid,product_code';
    }
    console.log('Generated eSewa SDK payload:', sdkPayload);
    return sdkPayload;
  }

  /**
   * Get the eSewa payment gateway URL (test or production based on env).
   * Test: https://rc-epay.esewa.com.np
   * Prod: https://esewa.com.np/epay/main
   */
  getPaymentUrl(): string {
    return this.getBaseUrl() + '/epay/main';
  }

  /**
   * PRIMARY VERIFICATION: Verify eSewa transaction using the transrec endpoint.
   * 
   * This is the standard verification method for the old eSewa Epay API.
   * After eSewa redirects the user back to our success URL, we call this
   * method with the refId (reference ID) provided by eSewa.
   *
   * Steps:
   * 1. POST to /epay/transrec with scd, rid (refId from eSewa), amt (total amount)
   * 2. eSewa returns XML: <response_code>Success</response_code> or Failure
   *
   * Supports both old Epay and new Epay-v2 verification.
   *
   * Reference: https://developer.esewa.com.np/#verification
   */
  async verifyTransaction(
    referenceId: string,
    totalAmount: number,
  ): Promise<boolean> {
    const scd = this.envService.getString('ESEWA_MERCHANT_CODE');
    const secretKey = this.envService.getString('ESEWA_SECRET_KEY');
    const baseUrl = this.getBaseUrl();

    // If secret key is provided, use Epay-v2 verification with HMAC signature
    if (secretKey) {
      return this.verifyEpayV2(baseUrl, scd, secretKey, referenceId, totalAmount);
    }

    // Fallback to old Epay verification (transrec endpoint)
    return this.verifyOldEpay(baseUrl, scd, referenceId, totalAmount);
  }

  /**
   * Old eSewa Epay verification (still widely used)
   * Uses the /epay/transrec endpoint for verification.
   */
  private async verifyOldEpay(
    baseUrl: string,
    scd: string,
    referenceId: string,
    totalAmount: number,
  ): Promise<boolean> {
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
      this.logger.error('eSewa old epay verification error:', error);
      return false;
    }
  }

  /**
   * New eSewa Epay-v2 verification using HMAC-SHA256 signature
   * Reference: https://developer.esewa.com.np/#epay-v2
   */
  private async verifyEpayV2(
    baseUrl: string,
    scd: string,
    secretKey: string,
    referenceId: string,
    totalAmount: number,
  ): Promise<boolean> {
    try {
      // Generate HMAC-SHA256 signature
      const message = `total_amount=${totalAmount},transaction_uuid=${referenceId},product_code=${scd}`;
      const signature = this.generateHmacSha256(message, secretKey);

      const url = `${baseUrl}/epay/v2/transactions/${referenceId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${signature}`,
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      // Epay-v2 returns JSON: { status: "COMPLETED", ... }
      return data.status === 'COMPLETED';
    } catch (error) {
      this.logger.error('eSewa epay-v2 verification error:', error);
      return false;
    }
  }

  /**
   * Generate HMAC-SHA256 signature for Epay-v2
   */
  private generateHmacSha256(message: string, secretKey: string): string {
    return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  }

  /**
   * FALLBACK STATUS CHECK: Get transaction status from eSewa Status API.
   * 
   * This should ONLY be used as a fallback when no callback is received
   * within 5 minutes (per eSewa documentation, step 6-7 in the flow).
   *
   * Primary verification should use verifyTransaction() with the refId
   * from eSewa's callback redirect.
   *
   * Reference: https://developer.esewa.com.np/#status
   */
  async getTransactionStatus(
    productCode: string,
    totalAmount: number,
    transactionUuid: string,
  ): Promise<'COMPLETE' | 'PENDING' | 'CANCELED' | 'NOT_FOUND' | 'AMBIGUOUS'> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/epay/transaction/status?product_code=${encodeURIComponent(productCode)}&total_amount=${encodeURIComponent(totalAmount)}&transaction_uuid=${encodeURIComponent(transactionUuid)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      const data = await response.json();

      if (data && typeof data.status === 'string') {
        const status = data.status.toUpperCase();
        if (['COMPLETE', 'PENDING', 'CANCELED', 'NOT_FOUND', 'AMBIGUOUS'].includes(status)) {
          return status as 'COMPLETE' | 'PENDING' | 'CANCELED' | 'NOT_FOUND' | 'AMBIGUOUS';
        }
      }
      return 'NOT_FOUND';
    } catch (error) {
      this.logger.error('eSewa status API error:', error);
      return 'NOT_FOUND';
    }
  }

  /**
   * Alternative: Verify using eSewa's SDK/client credentials flow
   * For server-to-server verification with OAuth2 client credentials
   */
  async verifyWithClientCredentials(
    referenceId: string,
    totalAmount: number,
    clientId?: string,
    clientSecret?: string,
  ): Promise<boolean> {
    const cid = clientId || this.envService.getString('ESEWA_CLIENT_ID', '');
    const csecret = clientSecret || this.envService.getString('ESEWA_CLIENT_SECRET', '');

    if (!cid || !csecret) {
      // Fallback to standard verification if client credentials not available
      return this.verifyTransaction(referenceId, totalAmount);
    }

    try {
      // Get access token first
      const tokenResponse = await fetch('https://auth.epay.gov.np/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${cid}:${csecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        return false;
      }

      // Verify transaction with access token
      const verifyUrl = `https://api.epay.gov.np/v1/transactions/${referenceId}`;
      const verifyResponse = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      const verifyData = await verifyResponse.json();
      return verifyData.status === 'COMPLETED';
    } catch (error) {
      this.logger.error('eSewa client credentials verification error:', error);
      return false;
    }
  }
}