import { registerEnumType } from "@nestjs/graphql";


export enum TransactionDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

registerEnumType(TransactionDirection, {
  name: 'TransactionDirection',
  description: 'Direction of the wallet transaction',
  valuesMap: {
    DEBIT: {
      description: 'Amount is deducted from wallet',
    },
    CREDIT: {
      description: 'Amount is added to wallet',
    },
  },
});

export enum TransactionType {
  RIDE_PAYMENT = 'RIDE_PAYMENT',
  TOPUP = 'TOPUP',
  WITHDRAWAL = 'WITHDRAWAL',
  COMMISSION = 'COMMISSION',
}

registerEnumType(TransactionType, {
  name: 'TransactionType',
  description: 'Type of wallet transaction',
  valuesMap: {
    RIDE_PAYMENT: {
      description: 'Payment made for a ride',
    },
    TOPUP: {
      description: 'Wallet balance top-up',
    },
    WITHDRAWAL: {
      description: 'Withdrawal from wallet',
    },
    COMMISSION: {
      description: 'Commission transaction',
    },
  },
});

export enum TransactionStatus {
    PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

registerEnumType(TransactionStatus, {
  name: 'TransactionStatus',
  description: 'Status of the wallet transaction',
  valuesMap: {
    COMPLETED: {
      description: 'Transaction completed successfully',
    },
    FAILED: {
      description: 'Transaction failed',
    },
  },
});

export enum WalletUserType {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

registerEnumType(WalletUserType, {
  name: 'WalletUserType',
  description: 'Type of wallet owner',
  valuesMap: {
    PASSENGER: {
      description: 'Wallet belongs to passenger',
    },
    DRIVER: {
      description: 'Wallet belongs to driver',
    },
    ADMIN: {
      description: 'Wallet belongs to admin',
    },
  },
});