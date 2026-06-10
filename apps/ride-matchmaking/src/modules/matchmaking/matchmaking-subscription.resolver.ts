import { Resolver, Subscription, Args } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from './pubsub.provider';
import { DriverMatchFoundEvent } from './driver-match-found.event';

export const DRIVER_MATCH_FOUND = 'DRIVER_MATCH_FOUND';

@Resolver()
export class MatchmakingSubscriptionResolver {
  constructor(
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @Subscription(() => DriverMatchFoundEvent, {
    name: 'driverMatchFound',
    description: 'Subscribe to driver match events for a specific ride',
    filter: (payload, variables) => {
      return payload.driverMatchFound.rideUUId === variables.rideUUId;
    },
    resolve: (payload) => {
      return payload.driverMatchFound;
    },
  })
  driverMatchFound(
    @Args('rideUUId') rideUUId: string,
  ) {
    return (this.pubSub as any).asyncIterator(DRIVER_MATCH_FOUND);
  }
}