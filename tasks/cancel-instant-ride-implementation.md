# Cancel Instant Ride Implementation Plan

## Changes needed:

1. **ride-matchmaking matchmaking.service.ts** - Add `cancelInstantRide` method
2. **ride-matchmaking matchmaking.resolver.ts** - Add `cancelInstantRide` GraphQL mutation
3. **api matchmaking-integration.service.ts** - Add GraphQL query + integration method
4. **api matchmaking.resolver.ts** - Add `cancelInstantRide` GraphQL mutation