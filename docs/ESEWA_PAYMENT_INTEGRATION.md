# eSewa Payment Integration Guide

## Overview

This document describes the complete eSewa Epay payment flow implemented in this application. The integration supports both **Old Epay** (form-based redirect with `/epay/transrec` verification) and **Epay-v2** (HMAC-SHA256 signature-based verification).

## eSewa Payment Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│  Frontend │         │   API    │         │  eSewa   │         │ MongoDB  │
│   (App)   │         │  Server  │         │ Payment  │         │          │
└─────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
      │                    │                    │                    │
      │ 1. initiateTopup   │                    │                    │
      │───────────────────>│                    │                    │
      │                    │ 2. Create PENDING  │                    │
      │                    │    Transaction     │                    │
      │                    │───────────────────>│                    │
      │                    │                    │                    │
      │ 3. Return {        │                    │                    │
      │    esewaPayload,   │                    │                    │
      │    successUrl,     │                    │                    │
      │    failureUrl }    │                    │                    │
      │<───────────────────│                    │                    │
      │                    │                    │                    │
      │ 4. User submits    │                    │                    │
      │    form to eSewa   │                    │                    │
      │────────────────────────────────────────>│                    │
      │                    │                    │                    │
      │                    │       5. User logs in & confirms        │
      │                    │                    │                    │
      │    6a. SUCCESS: Redirect to su URL     │                    │
      │        ?refId=xxx&transactionUuid=yyy  │                    │
      │<────────────────────────────────────────│                    │
      │                    │                    │                    │
      │    6b. FAILURE: Redirect to fu URL     │                    │
      │        ?transactionUuid=yyy            │                    │
      │<────────────────────────────────────────│                    │
      │                    │                    │                    │
      │ 7. User hits       │                    │                    │
      │    callback URL    │                    │                    │
      │───────────────────>│                    │                    │
      │                    │ 8. POST /epay/    │                    │
      │                    │    transrec       │                    │
      │                    │    (refId, amt)   │                    │
      │                    │──────────────────>│                    │
      │                    │                    │                    │
      │                    │ 9. XML Response   │                    │
      │                    │    Success/Failure │                    │
      │                    │<──────────────────│                    │
      │                    │                    │                    │
      │                    │ 10. Credit Wallet  │                   │
      │                    │    & Mark COMPLETED│                   │
      │                    │───────────────────>│                    │
      │                    │                    │                    │
      │ 11. Redirect to    │                    │                    │
      │     /payment/     │                    │                    │
      │     success/failure│                    │                    │
      │<───────────────────│                    │                    │
```

## Step-by-Step Flow

### Step 1: Initiate Topup

**Frontend** calls the GraphQL mutation:
```graphql
mutation InitiateTopup($amount: Float!, $paymentMedium: PaymentMediumEnum!) {
  initiateTopup(amount: $amount, paymentMedium: $paymentMedium) {
    transactionId
    amount
    status
    esewaPayload {
      paymentUrl
      formFields {
        amt
        psc
        pdc
        txAmt
        tAmt
        pid
        scd
        su
        fu
      }
      signature
      signedFields
    }
    gatewayUrl
    successUrl
    failureUrl
  }
}
```

**Backend (`WalletService.initiateTopup`)**:
1. Generates a random `transactionUuid` (e.g., `TOPUP-k8j2a-X3PQB`)
2. Creates a PENDING transaction in MongoDB with the `transactionUuid`
3. Builds callback URLs using `transactionUuid` (not MongoDB `_id`):
   - Success: `{API_BASE_URL}/payment/esewa/success?transactionUuid=TOPUP-xxx`
   - Failure: `{API_BASE_URL}/payment/esewa/failure?transactionUuid=TOPUP-xxx`
4. Generates the eSewa payment payload with form fields
5. Returns the payload to the frontend

### Step 2: Redirect to eSewa

**Frontend** creates an HTML form and submits it to eSewa:
```html
<form action="https://uat.esewa.com.np/epay/main" method="POST">
  <input type="hidden" name="amt" value="100">
  <input type="hidden" name="psc" value="0">
  <input type="hidden" name="pdc" value="0">
  <input type="hidden" name="txAmt" value="0">
  <input type="hidden" name="tAmt" value="100">
  <input type="hidden" name="pid" value="TOPUP-k8j2a-X3PQB">
  <input type="hidden" name="scd" value="EPAYTEST">
  <input type="hidden" name="su" value="http://localhost:3000/payment/esewa/success?transactionUuid=TOPUP-k8j2a-X3PQB">
  <input type="hidden" name="fu" value="http://localhost:3000/payment/esewa/failure?transactionUuid=TOPUP-k8j2a-X3PQB">
</form>
```

### Step 3: eSewa Processes Payment

User logs into eSewa and confirms the transaction.

### Step 4: eSewa Redirects Back

**On Success**: eSewa redirects to the `su` URL with parameters:
```
GET /payment/esewa/success?transactionUuid=TOPUP-k8j2a-X3PQB&refId=0000A1B2&oid=TOPUP-k8j2a-X3PQB
```
- `refId`: eSewa reference ID (used for verification)
- `oid`: Original product ID (our `transactionUuid`)
- `transactionUuid`: Our random identifier

**On Failure**: eSewa redirects to the `fu` URL:
```
GET /payment/esewa/failure?transactionUuid=TOPUP-k8j2a-X3PQB
```

### Step 5: Backend Verification

**`PaymentController.esewaSuccess()`** receives the callback:

```typescript
@Get('esewa/success')
async esewaSuccess(
  @Query('transactionUuid') transactionUuid: string,  // Our random ID
  @Query('refId') refId?: string,                       // eSewa reference ID
  @Query('oid') oid?: string,                          // Original product ID
) {
  // Delegates to wallet service
  await this.walletService.completeTopupByUuid(transactionUuid, 0, { refId });
}
```

**`WalletService.completeTopupByUuid()`**:
1. Looks up the transaction by `transactionUuid` in MongoDB
2. Delegates to `completeTopup(internalId, amount, { refId })`

**`WalletService.completeTopup()`** performs:
1. **Primary Verification**: POST to eSewa `/epay/transrec` with `scd`, `rid` (refId), `amt` (amount)
2. eSewa returns XML: `<response_code>Success</response_code>` or Failure
3. If verification passes → mark transaction as COMPLETED
4. Credit the user's wallet
5. Send success FCM notification

### Step 6: User Redirect

The API returns a redirect URL to the frontend:
- Success: `{FRONTEND_URL}/payment/success`
- Failure: `{FRONTEND_URL}/payment/failure`

## Verification Methods

### Primary: `/epay/transrec` (Old Epay)

```typescript
POST https://uat.esewa.com.np/epay/transrec
Content-Type: application/x-www-form-urlencoded

scd=EPAYTEST&rid=0000A1B2&amt=100
```

Response (XML):
```xml
<response_code>Success</response_code>
```

### Primary: `/epay/v2/transactions/{refId}` (Epay-v2)

```typescript
GET https://uat.esewa.com.np/epay/v2/transactions/0000A1B2
Authorization: Bearer {HMAC-SHA256 signature}
```

Response (JSON):
```json
{ "status": "COMPLETED" }
```

### Fallback: `/api/epay/transaction/status`

Used when no callback is received within 5 minutes (per eSewa documentation):

```typescript
GET https://uat.esewa.com.np/api/epay/transaction/status?product_code=EPAYTEST&total_amount=100&transaction_uuid=TOPUP-k8j2a-X3PQB
```

Response (JSON):
```json
{ "status": "COMPLETE" }
```

## Key Implementation Details

### Transaction UUID (Random ID)

```typescript
const transactionUuid = `TOPUP-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
// Example: TOPUP-k8j2a-X3PQB
```

- Used as the external identifier for all payment gateway callbacks
- NOT the MongoDB `_id` - prevents leaking internal IDs
- Stored in the `transactionUuid` field of the Transaction document
- Looked up via `findOne({ transactionUuid })` during callbacks

### Callback URL Construction

The `initiateTopup()` method builds callback URLs using the app's `API_BASE_URL` environment variable:

| App | Environment | API_BASE_URL | FRONTEND_URL |
|-----|-------------|-------------|--------------|
| api | User | http://localhost:3000 | http://localhost:3001 |
| driver-api | Driver | http://localhost:3002 | http://localhost:3001/driver |

### Error Handling

- **Verification failure**: Transaction marked as FAILED, user notified via FCM
- **MongoDB transaction errors**: Sanitized to user-friendly messages (e.g., "A temporary system error occurred")
- **Missing parameters**: Returns error response with appropriate message

## Environment Variables (api)

```env
# API base URL for constructing callback URLs (used by eSewa redirects)
API_BASE_URL=http://localhost:3000

# Frontend URL for redirecting users after successful/failed payment
FRONTEND_URL=http://localhost:3001

# eSewa Merchant Code - Test: EPAYTEST | Production: provided by eSewa
ESEWA_MERCHANT_CODE=EPAYTEST

# eSewa Secret Key for Epay-v2 HMAC-SHA256 signature (optional)
ESEWA_SECRET_KEY=

# eSewa OAuth2 Client Credentials (optional)
ESEWA_CLIENT_ID=
ESEWA_CLIENT_SECRET=
```

## Environment Variables (driver-api)

```env
# API base URL for constructing callback URLs (used by eSewa redirects)
API_BASE_URL=http://localhost:3002

# Frontend URL for redirecting users after successful/failed payment
FRONTEND_URL=http://localhost:3001

# Driver-facing frontend URL for redirecting drivers after payment
DRIVER_FRONTEND_URL=http://localhost:3001/driver

# eSewa Merchant Code - Test: EPAYTEST | Production: provided by eSewa
ESEWA_MERCHANT_CODE=EPAYTEST
```

## Testing with eSewa Test Environment

### Test Credentials
- **Merchant Code**: `EPAYTEST`
- **eSewa Test URL**: `https://uat.esewa.com.np/epay/main`
- **Test User Credentials**: Use any eSewa test account credentials

### Test Transaction
1. Start the API server on port 3000
2. Call `initiateTopup` with `paymentMedium: ESEWA`
3. Open the returned `gatewayUrl` in a browser
4. Login with eSewa test credentials
5. Confirm the payment
6. You will be redirected back to `{API_BASE_URL}/payment/esewa/success?transactionUuid=...`

## API Endpoints Reference

### GraphQL Mutations

| Mutation | Description |
|----------|-------------|
| `initiateTopup(amount, paymentMedium)` | Initiates a topup, returns eSewa payment payload |
| `completeTopup(transactionId, verifiedAmount)` | Completes a topup (internal _id-based) |
| `failTopup(transactionId)` | Fails a topup (internal _id-based) |

### REST Callbacks (GET)

| Endpoint | Description |
|----------|-------------|
| `GET /payment/esewa/success?transactionUuid=...&refId=...` | eSewa success callback |
| `GET /payment/esewa/failure?transactionUuid=...` | eSewa failure callback |

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Transaction not found" | Invalid transactionUuid | Ensure the callback URL has the correct `transactionUuid` |
| "eSewa transaction verification failed" | Invalid refId from eSewa | Check that the refId is being passed correctly |
| MongoDB transaction error | MongoDB running as standalone | Transaction removed - uses direct operations now |
| Notification shows MongoDB error | Error message not sanitized | Error sanitization already implemented |

### Debug Logs

Enable debug logging by checking the `PaymentController` and `EsewaService` logger output:
```
[PaymentController] eSewa success callback: transactionUuid=TOPUP-xxx, refId=0000A1B2, oid=TOPUP-xxx
[EsewaService] eSewa old epay verification error: ...
```

## Sequence of Files Involved

1. **`libs/services/payment/src/esewa/esewa.service.ts`** - eSewa API client (payload generation, verification)
2. **`libs/services/payment/src/wallet/wallet.service.ts`** - Wallet business logic (initiate, complete, fail topup)
3. **`apps/api/src/modules/wallet/payment.controller.ts`** - REST controller for payment callbacks
4. **`apps/driver-api/src/modules/wallet/payment.controller.ts`** - REST controller for driver payment callbacks
5. **`libs/common/config/env.service.ts`** - Environment variable access
6. **`libs/data-access/entities/transaction.entity.ts`** - Transaction MongoDB schema
7. **`libs/data-access/repositories/transaction.repository.ts`** - Transaction database operations