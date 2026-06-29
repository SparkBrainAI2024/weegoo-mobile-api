# Complete Ride 400 Error Analysis

## Root Cause

The `driver-ride-acceptance.service.ts` calls the matchmaking service's GraphQL endpoint with a mutation query that has **two field name mismatches**:

### Bug 1: `fareBreakDown` vs `fareBreakdown`
The Driver API query uses `fareBreakDown` (capital D) but the GraphQL schema defines the field as `fareBreakdown` (lowercase d) in `CompleteRideResult` DTO.

### Bug 2: `discountCharge` vs `distanceCharge`
The Driver API query uses `discountCharge` but the `CompleteRideFareBreakdown` DTO defines the field as `distanceCharge`.

## Flow
1. Driver app calls `driver-api` via its resolver
2. `driver-ride-acceptance.service.completeRide()` sends a POST to matchmaking GraphQL endpoint
3. GraphQL validates the query against the schema - finds unknown fields → returns HTTP 400
4. The error is caught and logged as "Failed to complete ride via matchmaking service: Request failed with status code 400"

## Fix
Change the GraphQL query in `driver-ride-acceptance.service.ts`:
- `fareBreakDown` → `fareBreakdown`
- `discountCharge` → `distanceCharge`