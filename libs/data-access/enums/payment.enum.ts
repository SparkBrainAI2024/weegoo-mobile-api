import { registerEnumType } from "@nestjs/graphql";

export enum PaymentMethodEnum {
    CASH = 'CASH',
    WALLET = 'WALLET'
}
registerEnumType(PaymentMethodEnum, {
    name: 'PaymentMethodEnum',
    description: 'Payment method for the ride',
    valuesMap: {
        CASH: {
            description: 'Payment method is cash',
        },
        WALLET: {
            description: 'Payment via internal wallet',
        }
    },
});

export enum PaymentMediumEnum {
    ESEWA = 'ESEWA',
    KHALTI = 'KHALTI',
}
registerEnumType(PaymentMediumEnum, {
    name: 'PaymentMediumEnum',
    description: 'Payment medium/gateway used for the transaction',
    valuesMap: {
        ESEWA: {
            description: 'Payment processed through eSewa gateway',
        },
        KHALTI: {
            description: 'Payment processed through Khalti gateway',
        },
    },
});