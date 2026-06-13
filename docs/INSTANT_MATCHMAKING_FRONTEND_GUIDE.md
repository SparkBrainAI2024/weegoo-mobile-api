# Instant Matchmaking — Frontend Integration Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Instant Matchmaking Process](#instant-matchmaking-process)
3. [Ably Channel Structure](#ably-channel-structure)
4. [Unified Event System](#unified-event-system)
5. [Passenger App Integration](#passenger-app-integration)
6. [Driver App Integration](#driver-app-integration)
7. [Event Payload Reference](#event-payload-reference)
8. [GraphQL API Reference](#graphql-api-reference)
9. [Error Handling](#error-handling)
10. [Push Notifications](#push-notifications)

---

## Architecture Overview

### Services

| Service | Directory | Role |
|---------|-----------|------|
| **Passenger API** | `apps/api/` | Creates rides, triggers matchmaking, manages passenger operations |
| **Ride Matchmaking** | `apps/ride-matchmaking/` | Core matching engine — finds, scores, and notifies drivers |
| **Driver API** | `apps/driver-api/` | Manages driver documents, vehicles, transactions |

### Communication Flow

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────────────┐         ┌──────────────┐
│              │ GraphQL │                  │ GraphQL │                      │  Ably   │              │
│ Passenger    │────────►│  Passenger API   │────────►│  Ride Matchmaking    │◄───────►│  Driver App  │
│ App          │◄────────│  (apps/api)      │◄────────│  Service             │◄───────►│              │
│              │  Subs   │                  │         │  (ride-matchmaking)  │         │              │
└──────────────┘         └──────────────────┘         └──────────────────────┘         └──────────────┘
                                  │                           │
                                  │     ┌─────────────────────┘
                                  │     │
                           MongoDB│     │Ably
                                  │     │
                              ┌───┘     └───┐
                              │             │
                           ┌──▼──┐    ┌─────▼─────┐
                           │  DB │    │ Ably Cloud │
                           └─────┘    └───────────┘
```

### Communication Protocols

| Channel | Protocol | Description |
|---------|----------|-------------|
| Passenger App → Passenger API | GraphQL (HTTP) | Ride creation, mutations, queries |
| Passenger API → Matchmaking Service | GraphQL (HTTP) | Trigger matchmaking (`matchDrivers`, `matchScheduledDrivers`) |
| Matchmaking Service → Driver App | **Ably** (real-time) | Send ride requests, publish ride details |
| Driver App → Matchmaking Service | **Ably** (real-time) | Driver accept/reject responses |
| Matchmaking Service → Both Apps | **Ably** (real-time) | Driver accepted, ride taken, location updates, ride details |
| Passenger API → Passenger App | GraphQL Subscriptions | Match found status updates |

---

## Instant Matchmaking Process

### Step-by-Step Flow

```
Passenger App           Passenger API            Matchmaking Service             Driver App
     │                         │                          │                          │
     │  1. Request Ride        │                          │                          │
     │ ─────────────────────►  │                          │                          │
     │                         │  2. Create Ride (PENDING) │                          │
     │                         │  3. matchDrivers(input)  │                          │
     │                         │ ───────────────────────► │                          │
     │                         │                          │                          │
     │                         │      4. Expanding Ring Algorithm                   │
     │                         │      5. Find eligible drivers                       │
     │                         │      6. Score & rank drivers                        │
     │                         │      7. Notify top 5 drivers via Ably              │
     │                         │                          │ ──────────────────────►  │
     │                         │                          │  driver-ride-request      │
     │                         │                          │                          │
     │                         │                          │  8. Wait 20s per ring     │
     │                         │                          │ ◄──────────────────────  │
     │                         │                          │  driver-response          │
     │                         │                          │   (accept/reject)         │
     │                         │                          │                          │
     │                         │  9. Return result        │                          │
     │                         │ ◄──────────────────────  │                          │
     │                         │                          │                          │
     │  10. Driver matched /   │                          │                          │
     │      No driver found    │                          │                          │
     │ ◄─────────────────────  │                          │                          │
```

### Expanding Ring Algorithm

The algorithm searches for drivers in expanding concentric rings:

```
Ring 1: 1 km radius  →  Wait 20s  →  No driver? → Ring 2
Ring 2: 2 km radius  →  Wait 20s  →  No driver? → Ring 3
Ring 3: 4 km radius  →  Wait 20s  →  No driver? → Ring 4
Ring 4: 7 km radius  →  Wait 20s  →  No driver? → Ring 5
Ring 5: 10 km radius →  Wait 20s  →  No driver? → Match Failed
```

**Key Rules:**
- Up to **5 drivers** are notified per ring
- Each driver has **20 seconds** to accept/reject
- **Minimum rating 4.0** for first 2 rings (bypassed after 2 failed attempts)
- Process **stops immediately** when a driver accepts

### Driver Scoring Formula

```
Score = (distance / maxDistance) × 0.6      (closer = better)
      + (rating / 5.0)        × -0.3       (higher rating = better)
      + (trips / maxTrips)    × 0.1        (more trips = better)
```

**Lower score = Better candidate**

### Driver Eligibility Filters

A driver must pass ALL of these filters:
1. ✅ User role is `RIDER` (driver)
2. ✅ Not suspended
3. ✅ Verified
4. ✅ `driverOnlineStatus` is `ONLINE`
5. ✅ No active ride (CONFIRMED, ONGOING, or PICKUP)
6. ✅ Meets minimum rating (≥ 4.0 for first 2 rings)
7. ✅ Within the current ring radius

---

## Ably Channel Structure

### Single Channel Per Ride

Each ride uses **one unified Ably channel**:

```
Channel Name: WG-RIDE-{rideUUId}-ride-details
```

Example:
```
WG-RIDE-abc123def456-ride-details
```

### Driver Request Channel (per driver)

Each driver has their own channel for receiving ride requests:

```
Channel Name: driver:{driverId}:rides
```

### Channel Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED RIDE CHANNEL                         │
│            WG-RIDE-{rideUUId}-ride-details                     │
│                                                                 │
│  Events (all use event name: "ride-detail"):                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ driver-ride-request     → Sent to specific driver       │   │
│  │ driver-response         → Driver accepts/rejects        │   │
│  │ driver-accepted         → Driver accepted the ride      │   │
│  │ driver-rejected         → Driver rejected the ride      │   │
│  │ ride-taken              → Ride taken by another driver  │   │
│  │ match-failed            → No driver found               │   │
│  │ driver-location-update  → Driver GPS location           │   │
│  │ passenger-location-update → Passenger GPS location      │   │
│  │ ride-details            → Full ride information         │   │
│  │ ride-status-update      → Ride status changed           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Unified Event System

All events on the ride channel use a **single event name** (`ride-detail`) with an `eventType` field in the payload to differentiate message types.

### Every Message Has This Structure

```typescript
{
  // --- Routing fields (added by server) ---
  rideUUId: string;        // The ride UUID
  eventType: string;       // The specific event type
  timestamp: string;       // ISO 8601 timestamp

  // --- Event-specific payload ---
  ...eventData
}
```

### Event Types

| `eventType` | Direction | Description |
|-------------|-----------|-------------|
| `driver-ride-request` | Server → Driver | Ride request sent to a driver via their personal channel |
| `driver-response` | Driver → Server | Driver accepts or rejects a ride |
| `driver-accepted` | Server → Both | A driver has accepted the ride |
| `driver-rejected` | Server → Both | A driver has rejected the ride |
| `ride-taken` | Server → Driver | Ride was accepted by another driver |
| `match-failed` | Server → Passenger | No driver found after all rings |
| `driver-location-update` | Server → Passenger | Real-time driver location |
| `passenger-location-update` | Server → Driver | Real-time passenger location |
| `ride-details` | Server → Both | Full ride information update |
| `ride-status-update` | Server → Both | Ride status changed |

---

## Passenger App Integration

### 1. Trigger Instant Matchmaking

**GraphQL Mutation:**

```graphql
mutation MatchDrivers($input: MatchDriversInput!) {
  matchDrivers(input: $input) {
    matched
    rideId
    rideUUId
    driverId
    driverName
    driverImage
    rating
    ablyChannelId
    estimatedFare {
      pickupCost
      distanceCost
      durationCost
      total
    }
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

**Response (matched):**

```json
{
  "data": {
    "matchDrivers": {
      "matched": true,
      "rideId": "64a1b2c3d4e5f6a7b8c9d0e1",
      "rideUUId": "WG-abc123def456",
      "driverId": "64a1b2c3d4e5f6a7b8c9d0e2",
      "driverName": "John Driver",
      "driverImage": "https://example.com/driver.jpg",
      "rating": 4.5,
      "ablyChannelId": "WG-RIDE-WG-abc123def456-ride-details",
      "estimatedFare": {
        "pickupCost": 50,
        "distanceCost": 100,
        "durationCost": 10,
        "total": 160
      },
      "attempts": [
        { "attemptNumber": 1, "radiusKm": 1, "waitTimeSeconds": 20, "driversFound": 2, "driversRequested": 2, "driverAccepted": false, "timeoutExpired": true, "status": "timeout" },
        { "attemptNumber": 2, "radiusKm": 2, "waitTimeSeconds": 20, "driversFound": 3, "driversRequested": 3, "driverAccepted": true, "timeoutExpired": false, "status": "accepted" }
      ],
      "message": "Driver matched successfully"
    }
  }
}
```

### 2. Subscribe to Ably Channel for Real-Time Updates

After receiving the `ablyChannelId` from the match result, subscribe to the unified ride channel:

```typescript
// ablyChannelId is returned from the matchDrivers mutation
const channelName = response.ablyChannelId; 
// e.g., "WG-RIDE-WG-abc123def456-ride-details"

const channel = ably.channels.get(channelName);

// Subscribe to all ride events (single event name: "ride-detail")
channel.subscribe('ride-detail', (message) => {
  const data = message.data;
  
  switch (data.eventType) {
    case 'driver-accepted':
      // A driver accepted the ride
      // data contains: driver info, vehicle info, pickup/dropoff, estimatedFare, etc.
      showDriverAcceptedDetails(data);
      break;

    case 'driver-rejected':
      // A driver rejected the ride
      showLookingForOtherDrivers();
      break;

    case 'ride-taken':
      // Ride was accepted by another driver (this driver can no longer accept)
      showRideTakenByAnotherDriver();
      break;

    case 'match-failed':
      // No drivers found within 10km
      showNoDriversFound(data.message);
      break;

    case 'driver-location-update':
      // Real-time driver location while en route
      updateDriverOnMap(data.latitude, data.longitude, data.distanceToReachPassenger, data.estimatedTimeToReachPassenger);
      break;

    case 'passenger-location-update':
      // Our own location being shared (confirmation)
      break;

    case 'ride-details':
      // Full ride details update (status, driver location, ETA, etc.)
      updateRideDetailsUI(data);
      break;

    case 'ride-status-update':
      // Ride status changed (e.g., CONFIRMED → ONGOING → COMPLETED)
      updateRideStatus(data.rideStatus);
      break;
  }
});
```

### 3. Subscribe to GraphQL Subscription for Match Events

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

### 4. Passenger App Flow Summary

```
1. User taps "Request Ride"
       │
2. Create ride via Passenger API
       │
3. Trigger matchDrivers mutation
       │
4. Subscribe to Ably channel using ablyChannelId
       │
5. Wait for mutation response:
   ├── matched: true  → Show driver details, track on map
   └── matched: false → Show "No drivers found" message
       │
6. Listen for real-time events on Ably channel:
   ├── driver-location-update → Update driver marker on map
   ├── ride-details → Update ride info
   └── ride-status-update → Navigate to appropriate screen
```

---

## Driver App Integration

### 1. Subscribe to Driver's Ride Request Channel

When the driver goes online, subscribe to their personal channel:

```typescript
const driverChannelName = `driver:${driverId}:rides`;

const channel = ably.channels.get(driverChannelName);

channel.subscribe('ride-detail', (message) => {
  const data = message.data;
  
  if (data.eventType === 'driver-ride-request') {
    // New ride request received!
    // Show ride request modal/card with countdown timer
    
    showRideRequest({
      rideId: data.rideId,
      rideUUId: data.rideUUId,
      rideType: data.rideType,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      distanceInKm: data.distanceInKm,
      estimatedFare: data.estimatedFare,
      estimatedTimeInMinutes: data.estimatedTimeInMinutes,
      expirySeconds: data.expirySeconds,
      attemptNumber: data.attemptNumber,
      isScheduled: data.isScheduled,
      bookingTime: data.bookingTime,
      passengerId: data.passengerId,
      driverScore: data.driverScore,
      distanceToPickupKm: data.distanceToPickupKm,
    });
  }
});
```

### 2. Accept or Reject a Ride

When the driver taps Accept or Reject, call the GraphQL mutation:

**Accept:**

```graphql
mutation DriverRespondToRide($input: DriverResponseInput!) {
  driverRespondToRide(input: $input) {
    success
    message
    ablyChannelId
    acceptedDetails {
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
      estimatedTimeInMinutes
      distanceInKm
      ablyChannelId
    }
  }
}
```

**Variables (Accept):**

```json
{
  "input": {
    "rideUUID": "WG-abc123def456",
    "driverId": "64a1b2c3d4e5f6a7b8c9d0e2",
    "action": "ACCEPT"
  }
}
```

**Variables (Reject):**

```json
{
  "input": {
    "rideUUID": "WG-abc123def456",
    "driverId": "64a1b2c3d4e5f6a7b8c9d0e2",
    "action": "REJECT"
  }
}
```

### 3. Subscribe to Ride Channel After Accepting

After accepting, use the `ablyChannelId` from the response to subscribe to the unified ride channel:

```typescript
// After successful accept
const rideChannelName = response.acceptedDetails.ablyChannelId;
// or construct it: `WG-RIDE-${rideUUID}-ride-details`

const channel = ably.channels.get(rideChannelName);

channel.subscribe('ride-detail', (message) => {
  const data = message.data;
  
  switch (data.eventType) {
    case 'passenger-location-update':
      // Real-time passenger location
      updatePassengerOnMap(data.latitude, data.longitude);
      break;

    case 'ride-details':
      // Full ride details update
      updateRideDetailsUI(data);
      break;

    case 'ride-status-update':
      // Ride status changed (e.g., CONFIRMED → ONGOING → COMPLETED)
      updateRideStatus(data.rideStatus);
      break;

    case 'driver-accepted':
      // Another driver accepted (if this is the same ride UUID)
      // This shouldn't happen for the accepting driver, but handle it
      break;
  }
});
```

### 4. Send Driver Location Updates

Periodically send driver location via GraphQL mutation:

```graphql
mutation UpdateDriverLocation($input: UpdateDriverLocationInput!) {
  updateDriverLocation(input: $input) {
    success
    message
    latitude
    longitude
    updatedAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "driverId": "64a1b2c3d4e5f6a7b8c9d0e2",
    "latitude": 27.7172,
    "longitude": 85.3240
  }
}
```

### 5. Driver App Flow Summary

```
1. Driver goes Online
       │
2. Subscribe to driver:{driverId}:rides channel
       │
3. Wait for ride requests...
       │
4. Receive driver-ride-request event
       │
5. Show ride request with countdown timer (expirySeconds)
       │
6. Driver taps Accept or Reject:
   ├── ACCEPT → Call driverRespondToRide(action: ACCEPT)
   │            ├── Subscribe to WG-RIDE-{rideUUId}-ride-details channel
   │            ├── Navigate to navigation screen
   │            └── Start sending location updates (every 5-10s)
   │
   └── REJECT → Call driverRespondToRide(action: REJECT)
                └── Wait for next ride request
```

---

## Event Payload Reference

### driver-ride-request

Sent to driver's personal channel when a ride request is assigned.

```json
{
  "eventType": "driver-ride-request",
  "rideId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "rideUUId": "WG-abc123def456",
  "rideType": "INSTANT",
  "pickupLocation": {
    "address": "Thamel, Kathmandu",
    "coordinates": [85.3122, 27.7172],
    "city": "Kathmandu"
  },
  "dropoffLocation": {
    "address": "Patan, Lalitpur",
    "coordinates": [85.3240, 27.6710],
    "city": "Lalitpur"
  },
  "distanceInKm": 5.2,
  "estimatedFare": 160,
  "estimatedTimeInMinutes": 18,
  "passengerId": "64a1b2c3d4e5f6a7b8c9d0e3",
  "driverScore": 0.85,
  "distanceToPickupKm": 1.5,
  "expirySeconds": 20,
  "attemptNumber": 1,
  "isScheduled": false
}
```

### driver-accepted

Published to ride channel when a driver accepts.

```json
{
  "eventType": "driver-accepted",
  "rideId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "rideUUId": "WG-abc123def456",
  "driver": {
    "driverId": "64a1b2c3d4e5f6a7b8c9d0e2",
    "fullName": "John Driver",
    "phone": "+977-9841234567",
    "profileImage": "https://example.com/driver.jpg",
    "rating": 4.5
  },
  "vehicle": {
    "vehicleId": "64a1b2c3d4e5f6a7b8c9d0e4",
    "vehicleModel": "Hyundai i10",
    "vehicleType": "CAR",
    "color": "White",
    "numberPlate": "Ba 12345",
    "year": 2020
  },
  "passenger": {
    "passengerId": "64a1b2c3d4e5f6a7b8c9d0e3",
    "fullName": "Jane Passenger",
    "phone": "+977-9851234567"
  },
  "pickupLocation": {
    "address": "Thamel, Kathmandu",
    "coordinates": [85.3122, 27.7172],
    "city": "Kathmandu"
  },
  "dropoffLocation": {
    "address": "Patan, Lalitpur",
    "coordinates": [85.3240, 27.6710],
    "city": "Lalitpur"
  },
  "estimatedFare": 160,
  "estimatedTimeInMinutes": 18,
  "distanceInKm": 5.2,
  "acceptedAt": "2024-01-15T10:30:00.000Z"
}
```

### driver-location-update

Real-time driver location published to ride channel.

```json
{
  "eventType": "driver-location-update",
  "driverId": "64a1b2c3d4e5f6a7b8c9d0e2",
  "latitude": 27.7180,
  "longitude": 85.3235,
  "distanceToReachPassenger": 0.8,
  "estimatedTimeToReachPassenger": 5,
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

### ride-details

Full ride details update (sent periodically and on status changes).

```json
{
  "eventType": "ride-details",
  "rideId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "rideUUId": "WG-abc123def456",
  "rideType": "INSTANT",
  "rideStatus": "ONGOING",
  "bookingTime": "2024-01-15T10:25:00.000Z",
  "pickupLocation": {
    "address": "Thamel, Kathmandu",
    "coordinates": [85.3122, 27.7172],
    "city": "Kathmandu"
  },
  "dropoffLocation": {
    "address": "Patan, Lalitpur",
    "coordinates": [85.3240, 27.6710],
    "city": "Lalitpur"
  },
  "distanceInKm": 5.2,
  "estimatedFare": 160,
  "estimatedTimeInMinutes": 18,
  "passenger": {
    "passengerId": "64a1b2c3d4e5f6a7b8c9d0e3",
    "fullName": "Jane Passenger",
    "phone": "+977-9851234567",
    "profileImage": "https://example.com/passenger.jpg"
  },
  "driver": {
    "driverId": "64a1b2c3d4e5f6a7b8c9d0e2",
    "fullName": "John Driver",
    "phone": "+977-9841234567",
    "profileImage": "https://example.com/driver.jpg",
    "rating": 4.5
  },
  "vehicle": {
    "vehicleId": "64a1b2c3d4e5f6a7b8c9d0e4",
    "vehicleModel": "Hyundai i10",
    "vehicleType": "CAR",
    "color": "White",
    "numberPlate": "Ba 12345",
    "year": 2020
  },
  "rideStartedAt": "2024-01-15T10:35:00.000Z",
  "rideCompletedAt": null,
  "updatedAt": "2024-01-15T10:40:00.000Z"
}
```

### ride-taken

Published when a ride has been accepted by another driver.

```json
{
  "eventType": "ride-taken",
  "rideUUId": "WG-abc123def456",
  "rideId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "message": "This ride has been accepted by another driver"
}
```

### match-failed

Published when no driver was found after all rings.

```json
{
  "eventType": "match-failed",
  "rideUUId": "WG-abc123def456",
  "rideId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "message": "No available drivers found within 10 km radius. Please try scheduling your ride.",
  "suggestion": "schedule"
}
```

---

## GraphQL API Reference

### Mutations

#### matchDrivers

Trigger instant matchmaking for a ride.

```graphql
mutation {
  matchDrivers(input: { rideId: "ride_mongo_id" }) {
    matched
    rideId
    rideUUId
    driverId
    driverName
    driverImage
    rating
    ablyChannelId
    estimatedFare {
      pickupCost
      distanceCost
      durationCost
      total
    }
    attempts {
      attemptNumber
      radiusKm
      waitTimeSeconds
      driversFound
      driversRequested
      driverAccepted
      acceptedDriverId
      timeoutExpired
      status
    }
    message
  }
}
```

#### driverRespondToRide

Driver accepts or rejects a ride request.

```graphql
mutation {
  driverRespondToRide(input: {
    rideUUID: "WG-abc123def456",
    driverId: "driver_mongo_id",
    action: ACCEPT
  }) {
    success
    message
    ablyChannelId
    acceptedDetails {
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
      estimatedTimeInMinutes
      distanceInKm
      ablyChannelId
    }
  }
}
```

#### updateDriverLocation

Update driver's real-time GPS location.

```graphql
mutation {
  updateDriverLocation(input: {
    driverId: "driver_mongo_id",
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

#### updatePassengerLocation

Update passenger's real-time GPS location.

```graphql
mutation {
  updatePassengerLocation(input: {
    passengerId: "passenger_mongo_id",
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

#### estimatedFare

```graphql
query {
  estimatedFare(input: { rideId: "ride_mongo_id" }) {
    pickupCost
    distanceCost
    durationCost
    total
  }
}
```

#### getVehicleEstimates

```graphql
query {
  getVehicleEstimates(
    pickupLocation: { latitude: 27.7172, longitude: 85.3240, address: "...", city: "Kathmandu" }
    dropoffLocation: { latitude: 27.6710, longitude: 85.3240, address: "...", city: "Lalitpur" }
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

#### driverMatchFound

Real-time match status updates for passenger.

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

## Error Handling

### Matchmaking Failure

When `matched: false` is returned, the passenger app should:
1. Display an appropriate message
2. Offer to schedule a ride for later
3. The ride is automatically deleted by the API

### Driver Response Timeout

Each driver has 20 seconds to respond. If they don't respond:
- The server moves to the next ring automatically
- No action needed from the driver app (the request just disappears)

### Network Issues

- **Ably reconnection:** The Ably SDK handles automatic reconnection. Use connection state listeners to show connection status.
- **Offline handling:** If the driver goes offline, they should not appear in matchmaking results (server-side check).

### Ride Already Accepted

If a driver tries to accept a ride that was already accepted by another driver, the `driverRespondToRide` mutation returns:

```json
{
  "success": false,
  "message": "Ride was already accepted by another driver"
}
```

---

## Push Notifications

### Notification Types

When a notification is sent via Firebase, the `data` payload includes:

```json
{
  "title": "Ride Accepted",
  "body": "Your ride request has been accepted by a driver...",
  "notificationType": "RIDE_ACCEPTED",
  "notificationId": "...",
  "ablyChannelId": "WG-RIDE-{rideUUId}-ride-details"
}
```

### Using ablyChannelId from Notifications

When a push notification contains `ablyChannelId`, the app should subscribe to that Ably channel for real-time updates:

```typescript
// On receiving push notification
if (notification.data.ablyChannelId) {
  const channel = ably.channels.get(notification.data.ablyChannelId);
  channel.subscribe('ride-detail', handleRideEvent);
}
```

---

## Configuration Reference

| Parameter | Value | Description |
|-----------|-------|-------------|
| `FALLBACK_RADII_KM` | `[1, 2, 4, 7, 10]` | Instant ride expanding ring radii |
| `SCHEDULED_FALLBACK_RADII_KM` | `[1, 3, 5, 10, 15]` | Scheduled ride expanding ring radii |
| `REQUEST_BATCH_SIZE` | `5` | Max drivers notified per ring |
| `MIN_ACCEPT_RATING` | `4.0` | Minimum driver rating |
| `BYPASS_RATING_AFTER_ATTEMPTS` | `2` | Bypass rating filter after N failed attempts |
| `DRIVER_RESPONSE_TIMEOUT` | `20s` | Time for driver to accept/reject per ring |