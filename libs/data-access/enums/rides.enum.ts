import { registerEnumType } from "@nestjs/graphql";

export enum RideTypes {
    INSTANT = 'INSTANT',
    SCHEDULED = 'SCHEDULED'
}

export enum RideStatus {
    CONFIRMED = 'CONFIRMED',
    ONGOING = 'ONGOING',
    PICKUP = 'PICKUP',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}
export const UpcomingRideStatus = "UPCOMING"; // Special status for filtering upcoming rides
registerEnumType(RideTypes, {
    name: 'RideTypes',
    description: 'Types of rides',
    valuesMap: {
        INSTANT: {
            description: 'Instant ride',
        },
        SCHEDULED: {
            description: 'Scheduled ride',
        },
    },
});

registerEnumType(RideStatus, {
    name: 'RideStatus',
    description: 'Rides status',
    valuesMap: {
        CONFIRMED: {
            description: 'Ride is confirmed',
        },
        ONGOING: {
            description: 'Ride is ongoing',
        },
        PICKUP: {
            description: 'Driver has picked up the rider',
        },
        COMPLETED: {
            description: 'Ride is completed',
        },
        CANCELLED: {
            description: 'Ride is cancelled',
        }
    }
});  