# Instant Matchmaking – System Design & Flow

## Architecture Overview

The ride-hailing platform uses a **microservice architecture** with three services working together for matchmaking:

| Service | Directory | Port | Role |
|---------|-----------|------|------|
| **Passenger API** | `apps/api/` | 3000 | Creates rides, triggers matchmaking, manages passenger operations |
| **Ride Matchmaking** | `apps/ride-matchmaking/` | 4000 | Core matching engine – finds, scores, and notifies drivers |
| **Driver API** | `apps/driver-api/` | — | Manages driver documents, vehicles, transactions |

All services share a **MongoDB** database and communicate via:
- **HTTP (GraphQL-over-HTTP)** — Passenger API → Matchmaking service
- **Ably** — Real-time bidirectional messaging between drivers/passengers and the matchmaking service
- **GraphQL Subscriptions (PubSub)** — Real-time updates to the Passenger API frontend

---

## Instant Matchmaking Flow

### High-Level Sequence

```
Passenger App          Passenger API (apps/api)         Matchmaking Service (apps/ride-matchmaking)          Driver App
     │                           │                              │                                           │
     │  1. Request Ride          │                              │                                           │
     │ ─────────────────────►    │                              │                                           │
     │                           │                              │                                           │
     │              2. Create Ride (PENDING)                    │                                           │
     │              3. HTTP POST /graphql                       │                                           │
     │              (matchDrivers mutation)                     │                                           │
     │                           │ ─────────────────────────►   │                                           │
     │                           │                              │                                           │
     │                           │              4. Expanding Ring Algorithm                                │
     │                           │              5. Find eligible drivers                                   │
     │                           │              6. Score & rank drivers                                    │
     │                           │              7. Notify top drivers via Ably                             │
     │                           │                              │ ────────────────────────────────────────►   │
     │                           │                              │    (ride-details event)                   │
     │                           │                              │                                           │
     │                           │              8. Wait for driver response (20s timeout)                  │
     │                           │                              │ ◄────────────────────────────────────────  │
     │                           │                              │    (driver-response event)                │
     │                           │                              │                                           │
     │                           │  9. Return match result      │                                           │
     │                           │ ◄─────────────────────────   │                                           │
     │                           │                              │                                           │
     │  10. Driver matched /     │                              │                                           │
     │      No driver found      │                              │                                           │
     │ ◄─────────────────────    │                              │                                           │
```

---

## Step-by-Step Flow

### Step 1: Passenger Requests a Ride

The passenger selects pickup/dropoff locations and vehicle type from the app. The `triggerInstantMatchmaking` method in `MatchmakingIntegrationService` (`apps/api/src/modules/rides/matchmaking-integration.service.ts`) handles the request.

### Step 2: Ride Creation

A ride is created in MongoDB with status `PENDING` and type `INSTANT`:

```typescript
rideData = {
  rideType: RideTypes.INSTANT,
  bookingTime: new Date(),
  rideStatus: RideStatus.PENDING,
  passengerId: userId,
  vehicleId: vehicle._id,
  pickupLocation: { type: 'Point', coordinates: [lng, lat], address, city, ... },
  dropoffLocation: { type: 'Point', coordinates: [lng, lat], address, city, ... },
  noOfPassengers: 1,
}
```

### Step 3: Trigger Matchmaking

The Passenger API calls the Matchmaking service via HTTP with a GraphQL mutation:

```graphql
mutation MatchDrivers($input: MatchDriversInput!) {
  matchDrivers(input: $input) {
    matched
    rideId
    rideUUId
    driverId
    driverName
    attempts { attemptNumber radiusKm driversFound driversRequested driverAccepted timeoutExpired }
    message
  }
}
```

**Timeout:** 120 seconds for the entire matchmaking process.

### Step 4: Expanding Ring Algorithm

The core algorithm uses **expanding concentric rings** around the passenger's pickup location to progressively widen the search:

```
Ring 1: 1 km radius  →  Wait 20s for driver response
Ring 2: 2 km radius  →  Wait 20s for driver response
Ring 3: 4 km radius  →  Wait 20s for driver response
Ring 4: 7 km radius  →  Wait 20s for driver response
Ring 5: 10 km radius →  Wait 20s for driver response
```

**Configuration** (from `MATCHMAKING_CONFIG`):

| Parameter | Value | Description |
|-----------|-------|-------------|
| `FALLBACK_RADII_KM` | `[1, 2, 4, 7, 10]` | Expanding ring radii in km |
| `DRIVER_RESPONSE_TIMEOUT` | `20 seconds` | Time window for driver to accept/reject |
| `MAX_DRIVERS_PER_RING` | `50` | Max vehicles queried per ring |
| `REQUEST_BATCH_SIZE` | `5` | Max drivers notified per ring |

The algorithm **stops as soon as a driver accepts**. If no driver responds in a ring, it moves to the next larger ring.

### Step 5: Driver Filtering

For each ring, the system queries vehicles matching the requested type and applies a multi-stage eligibility filter:

```
Vehicle Model (by vehicleType)
    │
    ▼
┌─────────────────────────────────────┐
│ Is the user a DRIVER (loginAs)?     │──No──► Skip
└─────────────────────────────────────┘
    │ Yes
    ▼
┌─────────────────────────────────────┐
│ Is the driver suspended or          │──Yes──► Skip
│ unverified?                         │
└─────────────────────────────────────┘
    │ No
    ▼
┌─────────────────────────────────────┐
│ Is the driver ONLINE?               │──No──► Skip
│ (driverOnlineStatus === ONLINE)     │
└─────────────────────────────────────┘
    │ Yes
    ▼
┌─────────────────────────────────────┐
│ Does the driver have an active ride?│──Yes──► Skip
│ (CONFIRMED, ONGOING, or PICKUP)     │
└─────────────────────────────────────┘
    │ No
    ▼
┌─────────────────────────────────────┐
│ Does the driver meet the minimum    │──No──► Skip
│ rating? (≥ 4.0, bypassed after     │
│ 2 failed attempts)                  │
└─────────────────────────────────────┘
    │ Yes
    ▼
┌─────────────────────────────────────┐
│ Is the driver within the ring       │──No──► Skip
│ radius? (distance calculated via    │
│ distance calculator service)        │
└─────────────────────────────────────┘
    │ Yes
    ▼
✅ Driver is eligible for this ring
```

### Step 6: Driver Scoring & Ranking

Eligible drivers are scored using a **weighted formula** with three factors:

```
Score = (distance / maxDistance) × 0.6      (Distance Weight — closer is better)
      + (rating / 5.0)        × -0.3       (Rating Weight — higher is better, negative = lower score is better)
      + (trips / maxTrips)    × 0.1        (Trip Count Weight — more experience is better)
```

| Weight Factor | Weight | Direction | Description |
|---------------|--------|-----------|-------------|
| Distance to pickup | 0.6 | Lower is better | Closer drivers are preferred |
| Rating | -0.3 | Higher is better | Negative weight means higher rating → lower (better) score |
| Completed trips | 0.1 | Higher is better | More experienced drivers get lower scores |

**Lower score = Better candidate.** Drivers are sorted ascending by score.

**Minimum rating threshold:**
- Attempt 1–2: Driver must have rating ≥ 4.0
- Attempt 3+: Rating filter is removed (bypass) to find more drivers

### Step 7: Notify Drivers via Ably

For the top N drivers (up to `REQUEST_BATCH_SIZE = 5`), the matchmaking service:

1. **Publishes ride details** on Ably channel `driver:{driverId}:rides`:
   ```json
   {
     "rideId": "...",
     "rideUUId": "WG-XXXXXX",
     "rideType": "INSTANT",
     "pickupLocation": { "address": "...", "coordinates": [lng, lat] },
     "dropoffLocation": { "address": "...", "coordinates": [lng, lat] },
     "distanceInKm": 5.2,
     "estimatedFare": 150,
     "estimatedTimeInMinutes": 15,
     "driverScore": 0.35,
     "distanceToPickupKm": 1.2,
     "expirySeconds": 20,
     "attemptNumber": 1
   }
   ```

2. **Sends a push notification** to the driver via `NotificationService` with type `RIDE_REQUEST`.

3. **Publishes a GraphQL Subscription event** (`driverMatchFound`) for the passenger's frontend to receive real-time updates.

### Step 8: Wait for Driver Response

The matchmaking service subscribes to the Ably channel `WG-RIDE-{rideUUId}:driver-response` and waits for a `driver-response` event:

```typescript
{
  driverId: "driver_object_id",
  action: "accept" | "reject"
}
```

**Timeout:** 20 seconds per ring. If no driver responds, the search moves to the next ring.

### Step 9: Process Driver Response

#### If Driver Accepts:
1. Ride status updates from `PENDING` → `CONFIRMED`
2. Ride's `driverId` is set to the accepting driver
3. Acceptance details are published via Ably to the passenger:
   ```json
   {
     "rideId": "...",
     "rideUUId": "WG-XXXXXX",
     "driver": { "driverId": "...", "fullName": "...", "profileImage": "...", "rating": 4.5 },
     "vehicle": { "vehicleModel": "...", "color": "...", "numberPlate": "..." },
     "estimatedFare": 150,
     "estimatedTimeInMinutes": 15,
     "distanceInKm": 5.2,
     "acceptedAt": "2024-01-15T10:30:00.000Z"
   }
   ```
4. A `rideTaken` event is published to prevent other drivers from accepting
5. The passenger receives a push notification: *"Your ride request has been accepted"*
6. **Matchmaking stops** — no further rings are searched

#### If Driver Rejects:
1. Rejection is published via Ably to the passenger's ride channel
2. Passenger receives a notification: *"A driver has declined. We are looking for other drivers."*
3. **Search continues** to the next ring

#### If Timeout (No Response):
1. A timeout event is published via GraphQL Subscription
2. The search moves to the next larger ring

### Step 10: Return Result to Passenger API

The matchmaking result is returned via HTTP response:

**Success:**
```json
{
  "matched": true,
  "rideId": "ride_mongo_id",
  "rideUUId": "WG-XXXXXXXXXXXXXXXX",
  "driverId": "driver_mongo_id",
  "driverName": "John Doe",
  "estimatedFare": { "pickupCost": 50, "distanceCost": 100, "durationCost": 10, "total": 160 },
  "attempts": [
    { "attemptNumber": 1, "radiusKm": 1, "driversFound": 2, "driversRequested": 2, "driverAccepted": false },
    { "attemptNumber": 2, "radiusKm": 2, "driversFound": 3, "driversRequested": 3, "driverAccepted": true }
  ],
  "message": "Driver matched successfully"
}
```

**Failure (all rings exhausted):**
```json
{
  "matched": false,
  "rideId": "ride_mongo_id",
  "rideUUId": "WG-XXXXXXXXXXXXXXXX",
  "attempts": [...5 attempts...],
  "message": "No available drivers found within 10 km radius. Please try scheduling your ride."
}
```

**Important:** If matchmaking fails, the Passenger API **deletes the ride** to prevent orphaned PENDING rides.

---

## Fare Calculation

### Instant Fare Formula

```
Total Fare = BasePickupCost + (DistanceKm × PerKmRate) + (DurationMinutes × PerMinuteRate)
```

| Vehicle Type | Base Pickup | Per Km | Per Minute |
|--------------|-------------|--------|------------|
| CAR | NPR 50 | NPR 20 | NPR 5 |
| MOTORBIKE | NPR 30 | NPR 12 | NPR 3 |
| SCOOTER | NPR 35 | NPR 15 | NPR 4 |

Distance and duration are calculated by the `DistanceCalculatorService` which provides route-aware estimates.

---

## Real-Time Communication Channels

### Ably Channels

| Channel Pattern | Event | Direction | Description |
|-----------------|-------|-----------|-------------|
| `driver:{driverId}:rides` | `ride-details` | Server → Driver | Sends ride request to a specific driver |
| `driver:{driverId}:rides` | `scheduled-ride-details` | Server → Driver | Sends scheduled ride request |
| `WG-RIDE-{rideUUId}:driver-response` | `driver-response` | Driver → Server | Driver accepts/rejects a ride |
| `WG-RIDE-{rideUUId}-ride-details` | `driver-accepted` | Server → Passenger | Notifies passenger of acceptance |
| `WG-RIDE-{rideUUId}-ride-details` | `ride-taken` | Server → All | Prevents other drivers from accepting |
| `WG-RIDE-{rideUUId}-ride-details` | `match-failed` | Server → Passenger | Notifies passenger of match failure |
| `WG-RIDE-{rideUUId}-ride-details` | `driver-location` | Server → Passenger | Real-time driver location updates |
| `WG-RIDE-{rideUUId}-ride-details` | `ride-details` | Server → Both | Full ride details updates |

### GraphQL Subscriptions

| Subscription | Filter | Description |
|--------------|--------|-------------|
| `driverMatchFound(rideUUId)` | `rideUUId` matches | Real-time match status updates for passenger |

**Event statuses:** `waiting_for_response` → `accepted` | `timeout` | `match_failed`

---

## Configuration Reference

All matchmaking parameters are defined in `libs/common/constants/index.ts`:

```typescript
MATCHMAKING_CONFIG = {
  // Instant Ride
  FALLBACK_RADII_KM: [1, 2, 4, 7, 10],
  MAX_DRIVERS_PER_RING: 50,
  REQUEST_BATCH_SIZE: 5,
  MIN_ACCEPT_RATING: 4.0,
  BYPASS_RATING_AFTER_ATTEMPTS: 2,

  // Scoring
  SCORING: {
    DISTANCE_WEIGHT: 0.6,
    RATING_WEIGHT: -0.3,
    COMPLETED_TRIPS_WEIGHT: 0.1,
  },

  // Fare
  FARE: {
    BASE_PICKUP_COST: { CAR: 50, MOTORBIKE: 30, SCOOTER: 35 },
    PER_KM_RATE: { CAR: 20, MOTORBIKE: 12, SCOOTER: 15 },
    PER_MINUTE_RATE: { CAR: 5, MOTORBIKE: 3, SCOOTER: 4 },
  },

  USER_CANCELLATION_LIMIT_PER_MONTH: 3,
}
```

---

## GraphQL API Reference

### Mutations

#### `matchDrivers` — Trigger instant matchmaking
```graphql
mutation {
  matchDrivers(input: { rideId: "ride_id" }) {
    matched
    rideId
    rideUUId
    driverId
    driverName
    driverImage
    rating
    estimatedFare { pickupCost distanceCost durationCost total }
    attempts {
      attemptNumber
      radiusKm
      waitTimeSeconds
      driversFound
      driversRequested
      driverAccepted
      timeoutExpired
      status
    }
    message
  }
}
```

#### `driverRespondToRide` — Driver accepts/rejects
```graphql
mutation {
  driverRespondToRide(input: {
    rideUUID: "WG-XXXXXXXXXXXXXXXX",
    driverId: "driver_id",
    action: "accept"
  }) {
    success
    message
  }
}
```

#### `updateDriverLocation` — Real-time driver location
```graphql
mutation {
  updateDriverLocation(input: {
    driverId: "driver_id",
    latitude: 27.7172,
    longitude: 85.3240
  }) {
    success
    message
    latitude
    longitude
    updatedAt
  }
}
```

### Queries

#### `estimatedFare` — Get fare estimate for instant ride
```graphql
query {
  estimatedFare(input: { rideId: "ride_id" }) {
    pickupCost
    distanceCost
    durationCost
    total
  }
}
```

#### `getVehicleEstimates` — Get estimates for all vehicle types
```graphql
query {
  getVehicleEstimates(
    pickupLocation: { latitude: 27.7172, longitude: 85.3240, address: "...", city: "Kathmandu" }
    dropoffLocation: { latitude: 27.7000, longitude: 85.3000, address: "...", city: "Kathmandu" }
    noOfPassengers: 1
  ) {
    vehicleType
    estimatedFare
    distanceKm
    estimatedTimeInMinutes
    comfortType
    hasAC
  }
}
```

### Subscriptions

#### `driverMatchFound` — Real-time match events
```graphql
subscription OnDriverMatchFound($rideUUId: String!) {
  driverMatchFound(rideUUId: $rideUUId) {
    rideId
    rideUUId
    driverId
    driverName
    driverImage
    rating
    vehicleType
    vehicleModel
    color
    numberPlate
    estimatedFare
    distanceToPickupKm
    attemptNumber
    status
    message
    timestamp
  }
}
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/ride-matchmaking/src/modules/matchmaking/matchmaking.service.ts` | Core matchmaking logic (expanding ring, filtering, scoring, response handling) |
| `apps/ride-matchmaking/src/modules/matchmaking/matchmaking.resolver.ts` | GraphQL mutations/queries entry points |
| `apps/ride-matchmaking/src/modules/matchmaking/matchmaking-subscription.resolver.ts` | GraphQL subscription for real-time events |
| `apps/ride-matchmaking/src/modules/matchmaking/driver-match-found.event.ts` | Event type definition for subscription |
| `apps/ride-matchmaking/src/modules/matchmaking/services/distance-calculator.service.ts` | Route distance & duration calculation |
| `apps/ride-matchmaking/src/modules/matchmaking/services/dynamic-pricing.service.ts` | Fare calculation service |
| `apps/ride-matchmaking/src/modules/matchmaking/pubsub.provider.ts` | PubSub provider for GraphQL subscriptions |
| `apps/api/src/modules/rides/matchmaking-integration.service.ts` | HTTP integration layer between Passenger API and Matchmaking service |
| `libs/common/constants/index.ts` | All matchmaking configuration constants |
| `libs/data-access/entities/rides.entity.ts` | Ride schema definition |
| `libs/data-access/enums/rides.enum.ts` | Ride status and type enums |
| `libs/services/ably/` | Ably real-time messaging service |