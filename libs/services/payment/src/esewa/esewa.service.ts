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

export interface EsewaStatusResponse {
  status: string;
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
   * Test: https://uat.esewa.com.np/epay/main
   * Prod: https://esewa.com.np/epay/main
   */
  getPaymentUrl(): string {
    const isProduction = this.envService.isProduction();
    return isProduction
      ? 'https://esewa.com.np/epay/main'
      : 'https://uat.esewa.com.np/epay/main';
  }

  /**
   * Verify eSewa transaction after successful payment.
   * Supports both old Epay and new Epay-v2 verification.
   * 
   * Old Epay: POST https://uat.esewa.com.np/epay/transrec
   * New Epay-v2: Uses HMAC-SHA256 signature with secret key
   * 
   * Reference: https://developer.esewa.com.np/#verification
   */
  async verifyTransaction(
    referenceId: string,
    totalAmount: number,
  ): Promise<boolean> {
    const scd = this.envService.getString('ESEWA_MERCHANT_CODE', 'EPAYTEST');
    const secretKey = this.envService.getString('ESEWA_SECRET_KEY', '');
    const isProduction = this.envService.isProduction();
    const baseUrl = isProduction ? 'https://esewa.com.np' : 'https://uat.esewa.com.np';

    // If secret key is provided, use Epay-v2 verification with HMAC signature
    if (secretKey) {
      return this.verifyEpayV2(baseUrl, scd, secretKey, referenceId, totalAmount);
    }

    // Fallback to old Epay verification
    return this.verifyOldEpay(baseUrl, scd, referenceId, totalAmount);
  }

  /**
   * Old eSewa Epay verification (still widely used)
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
      console.error('eSewa old epay verification error:', error);
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
      console.error('eSewa epay-v2 verification error:', error);
      return false;
    }
  }

  /**
   * Generate HMAC-SHA256 signature for Epay-v2
   */
  private generateHmacSha256(message: string, secretKey: string): string {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  }

  /**
   * Get transaction status from eSewa Status API (for topup verification)
   * Reference: https://developer.esewa.com.np/#status
   */
  async getTransactionStatus(
    productCode: string,
    totalAmount: number,
    transactionUuid: string,
  ): Promise<'COMPLETE' | 'PENDING' | 'CANCELED' | 'NOT_FOUND' | 'AMBIGUOUS'> {
    const isProduction = this.envService.isProduction();
    const baseUrl = isProduction ? 'https://esewa.com.np' : 'https://uat.esewa.com.np';

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
      console.error('eSewa status API error:', error);
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
      console.error('eSewa client credentials verification error:', error);
      return false;
    }
  }
}