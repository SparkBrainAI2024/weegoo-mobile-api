import { registerEnumType } from '@nestjs/graphql';

export enum CancellationByEnum {
    SELF = 'SELF',
    DRIVER_CANCELLED = 'DRIVER_CANCELLED'
}

registerEnumType(CancellationByEnum, {
    name: 'CancellationByEnum',
    description: 'The reason for cancellation',
    valuesMap: {
        SELF: {
            description: 'The ride was cancelled by the user themselves',
        },
        DRIVER_CANCELLED: {
            description: 'The ride was cancelled by the driver',
        },
    },

});