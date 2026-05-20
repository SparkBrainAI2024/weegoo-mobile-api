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
            description: 'Payment method is wallet',
        },
    },
}); 