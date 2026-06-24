# Race Condition Analysis: Instant Matchmaking + Driver Response

## Flow A: `executeExpandingRingMatch` (called via `matchDrivers` GraphQL)
1. Sets up Ably subscription listening for `driver-response` events
2. Loops through drivers, sending ride requests (with await calls)
3. Awaits the `driverResponsePromise` (either response or timeout)
4. If accepted, returns `matched: true`

## Flow B: `handleDriverResponse` (called via `driverRespondToRide` GraphQL)
1. Publishes `driver-response` event to Ably
2. Does `findOneAndUpdate` with atomic `{ rideStatus: PENDING }` condition
3. If accept: publishes `driver-accepted`, `ride-taken`, notifications

## The Race Condition:

### Issue 1: No ride status check in INSTANT loop
In `executeExpandingRingMatch`, the SCHEDULED version checks `rideStatus !== PENDING` at each attempt loop iteration and breaks if already accepted. The INSTANT version does NOT have this check. If a driver accepts via `handleDriverResponse` during attempt 1, attempt 2+ still runs unnecessarily.

### Issue 2: `handleDriverResponse` can accept AFTER matchmaking timed out
Timeline:
- t=0: matchDrivers starts, subscription with 20s timeout
- t=20: timeout expires, matchmaking returns `matched: false`
- t=21: driver accepts via handleDriverResponse
- Result: Ride was deleted by triggerInstantMatchmaking, driver gets confused

### Issue 3: `subscribeForDriverResponse` unsubscribe affects ALL listeners
The `unsubscribe()` function calls `channel.unsubscribe()` with no args, which removes ALL listeners on that channel for the 'ride-detail' event.

### Issue 4: Missing current attempt from attempts array
When accept happens, the function returns before `attempts.push(...)` is called, so the current attempt is not recorded.