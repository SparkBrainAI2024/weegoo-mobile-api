# Frontend Integration Guide — Instant Matchmaking

> **Target audience:** Mobile app developers (React Native / Flutter / Native) building the **Passenger App** and **Driver App**.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How Instant Matchmaking Works](#2-how-instant-matchmaking-works)
3. [Real-Time Communication — Ably](#3-real-time-communication--ably)
4. [Passenger App Integration](#4-passenger-app-integration)
5. [Driver App Integration](#5-driver-app-integration)
6. [Event Reference Tables](#6-event-reference-tables)
7. [Error Handling & Edge Cases](#7-error-handling--edge-cases)

---

## 1. Architecture Overview

```
┌──────────────┐      GraphQL       ┌────────────────────┐      GraphQL       ┌──────────────────┐
│              │ ──────────────────► │                    │ ──────────────────► │                  │
│ Passenger App│ ◄────────────────── │   Passenger API    │                    │  Ride Matchmaking│
│              │   (Subscriptions)   │    (apps/api)      │    (HTTP POST)     │    Service       │
└──────────────┘                     └────────────────────┘                    │(ride-matchmaking)│
       │                                    │                                  └────────┬─────────┘
       │                                    │                                        │
       │                                    │                                    Ably│Channel
       │                                    │                                        │
       │           Ably Channel            │                                 ┌──────┴────────┐
       └────────────────────────────────────────────────────────────────────►│   Ably Cloud  │
                         (ride-detail event)                                 └──────┬────────┘
       ┌──────────────┐                                                         │
       │              │ ◄─────────────────────────────────────────────────────────┘
       │  Driver App  │              Ably Channel (ride-detail event)
       │              │ ◄─── driver-ride-request, driver-accepted, ride-taken, etc.
       └──────────────┘
```

**Three services are involved:**

| Service | Port | Role |
|---------|------|------|
| Passenger API (`apps/api/`) | 3000 | Creates rides, triggers matchmaking, manages passenger operations |
| Ride Matchmaking (`apps/ride-matchmaking/`) | 4000 | Core matching engine — finds, scores, and notifies drivers |
| Driver API (`apps/driver-api/`) | — | Manages driver documents, vehicles, transactions |

**Real-time communication uses:**
- **Ably** — Bidirectional messaging between drivers/passengers and the server
- **GraphQL Subscriptions** — Real-time updates to the Passenger App frontend

---

## 2. How Instant Matchmaking Works

### Step-by-Step Flow

```
Passenger App              API                  Matchmaking Service              Driver App
     │                       │                          │                            │
     │  1. Request Ride      │                          │                            │
     │ ──────────────────►   │                          │                            │
     │                       │  2. Create Ride(PENDING) │                            │
     │                       │  3. HTTP POST mutation   │                            │
     │                       │     matchDrivers         │                            │
     │                       │ ──────────────────────►  │                            │
     │                       │                          │  4. Expanding Ring         │
     │                       │                          │  5. Find eligible drivers  │
     │                       │                          │  6. Score & rank drivers   │
     │                       │                          │  7. Notify top 5 via Ably  │
     │                       │                          │ ─────────────────────────► │
     │                       │                          │                            │
     │                       │                          │  8. Wait 20s per ring      │
     │                       │                          │ ◄───────────────────────── │
     │                       │                          │   (accept/reject)          │
     │                       │                          │                            │
     │                       │  9. Return result        │                            │
     │                       │ ◄──────────────────────  │                            │
     │                       │                          │                            │
     │  10. Driver matched   │                          │                            │
     │      or not found     │                          │                            │
     │ ◄──────────────────   │                          │                            │
```

### The Expanding Ring Algorithm

The system searches for drivers in expanding concentric rings around the passenger's pickup location:

| Ring | Radius | Wait Time | Rating Requirement |
|------|--------|-----------|-------------------|
| 1 | 1 km | 20 seconds | ≥ 4.0 |
| 2 | 2 km | 20 seconds | ≥ 4.0 |
| 3 | 4 km | 20 seconds | Any |
| 4 | 7 km | 20 seconds | Any |
| 5 | 10 km | 20 seconds | Any |

The algorithm **stops as soon as a driver accepts**. If no driver responds in a ring, it moves to the next larger ring.

### Driver Scoring

Drivers are ranked using a weighted formula:

```
Score = (distance / maxDistance) × 0.6      ← Closer is better
      + (rating / 5.0)        × -0.3       ← Higher rating is better
      + (trips / maxTrips)    × 0.1        ← More experience is better
```

**Lower score = Better candidate.** The top 5 drivers per ring are notified.

---

## 3. Real-Time Communication — Ably

### Channel Structure

Each ride gets **ONE Ably channel**:

```
Channel Name: WG-RIDE-{rideUUId}-ride-details
```

**ALL ride-related events** are published on this single channel using the event name `ride-detail`.

### Message Structure

Every message on the `ride-detail` event includes a top-level `eventType` field to differentiate message types:

```json
{
  "eventType": "driver-accepted",
  "rideUUId": "WG-XXXXXXXXXXXXXXXX",
  "timestamp": "2024-01-15T10:30:00.000Z",
  ...additional payload fields...
}
```

### Event Types

| `eventType` | Direction | Description |
|-------------|-----------|-------------|
| `driver-ride-request` | Server → Driver | Ride request sent to a specific driver |
| `driver-response` | Driver → Server | Driver accepts/rejects a ride |
| `driver-accepted` | Server → Both | Driver accepted the ride |
| `driver-rejected` | Server → Both | Driver rejected the ride |
| `ride-taken` | Server → All | Ride was taken by another driver |
| `match-failed` | Server → Passenger | No driver found after all rings |
| `driver-location-update` | Server → Both | Real-time driver GPS location |
| `passenger-location-update` | Server → Both | Real-time passenger GPS location |
| `ride-details` | Server → Both | Full ride information update |
| `ride-status-update` | Server → Both | Ride status changed |

### Firebase Push Notifications

In addition to Ably real-time events, push notifications are sent via Firebase with data payload:

```json
{
  "title": "Ride Accepted",
  "body": "Your ride request has been accepted by a driver...",
  "notificationType": "RIDE_ACCEPTED",
  "notificationId": "...",
  "ablyChannelId": "WG-RIDE-{rideUUId}-ride-details"
}
```

The `ablyChannelId` in the notification data tells the mobile app which Ably channel to subscribe to for real-time updates.

---

## 4. Passenger App Integration

### 4.1 Requesting a Ride (GraphQL Mutation)

When the passenger taps "Request Ride", call the `matchDrivers` mutation:

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
      acceptedDriverId
      timeoutExpired
      status
    }
    message
  }
}
```

**Variables:**
```json
{
  "input": {
    "rideId": "ride_mongo_id"
  }
}
```

**Important:** This mutation is **long-running** (up to 120 seconds) as the server searches for drivers across multiple rings.

### 4.2 Subscribing to Real-Time Updates (GraphQL Subscription)

Subscribe to `driverMatchFound` for real-time match status:

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

**Subscribe BEFORE calling `matchDrivers`** so you don't miss any events.

### 4.3 Subscribing to Ably Channel (Direct Real-Time)

For real-time ride updates after the driver is matched, subscribe to the Ably channel:

```javascript
// After receiving rideUUId and ablyChannelId from the matchDrivers response
const channelName = response.ablyChannelId; // "WG-RIDE-{rideUUId}-ride-details"

const channel = ably.channels.get(channelName);

// Subscribe to all ride-detail events
channel.subscribe('ride-detail', (message) => {
  const { eventType, ...data } = message.data;

  switch (eventType) {
    case 'driver-accepted':
      // Driver accepted the ride — show driver details
      showDriverInfo(data.driver, data.vehicle, data.estimatedFare);
      break;

    case 'driver-rejected':
      // Driver rejected — show "looking for another driver"
      showLookingForDriver();
      break;

    case 'ride-taken':
      // Ride was accepted by another driver
      showRideTaken();
      break;

    case 'match-failed':
      // No drivers found
      showNoDriversFound(data.message);
      break;

    case 'driver-location-update':
      // Real-time driver location
      updateDriverMarker(data.latitude, data.longitude);
      updateETA(data.distanceToReachPassenger, data.estimatedTimeToReachPassenger);
      break;

    case 'ride-details':
      // Full ride details update
      updateRideScreen(data);
      break;

    case 'ride-status-update':
      // Ride status changed (CONFIRMED → ONGOING → COMPLETED)
      updateRideStatus(data.rideStatus);
      break;
  }
});
```

### 4.4 Complete Passenger App Flow

```
1. Passenger taps "Request Ride"
2. Subscribe to GraphQL Subscription: driverMatchFound(rideUUId)
3. Call matchDrivers mutation (waits up to 120s)
4. Show loading screen: "Finding your driver..."
   ├── Each attempt → update UI: "Searching 2km radius..."
   ├── driver-rejected event → "Looking for another driver..."
   └── ride-taken event → "Ride taken by another driver"
5. On matchDrivers response or driver-accepted Ably event:
   ├── matched = true → Show driver details + Ably channel for location tracking
   └── matched = false → Show "No drivers found" + suggest scheduling
6. Subscribe to Ably channel (ablyChannelId) for:
   ├── driver-location-update → Update map with driver position
   └── ride-status-update → Update ride progress UI
```

### 4.5 Passenger App — Push Notification Handling

When a Firebase push notification arrives with `ablyChannelId` in the data payload:

```javascript
// Firebase notification handler
messaging.onNotification((remoteMessage) => {
  const { ablyChannelId, notificationType } = remoteMessage.data;

  if (ablyChannelId) {
    // Subscribe to the ride's Ably channel for real-time updates
    const channel = ably.channels.get(ablyChannelId);
    channel.subscribe('ride-detail', handleRideDetailEvent);
  }

  // Show appropriate UI based on notification type
  switch (notificationType) {
    case 'RIDE_ACCEPTED':
      showDriverAcceptedScreen();
      break;
    case 'RIDE_REQUEST':
      // Driver side: show ride request
      showRideRequestModal();
      break;
  }
});
```

---

## 5. Driver App Integration

### 5.1 Receiving Ride Requests (Ably Channel)

Subscribe to the driver's personal Ably channel to receive ride requests:

```javascript
// Subscribe to driver's ride request channel
const channel = ably.channels.get(`driver:${driverId}:rides`);

channel.subscribe('ride-detail', (message) => {
  const { eventType, ...data } = message.data;

  if (eventType === 'driver-ride-request') {
    // New ride request received
    showRideRequestModal({
      rideId: data.rideId,
      rideUUId: data.rideUUId,
      rideType: data.rideType,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      distanceInKm: data.distanceInKm,
      estimatedFare: data.estimatedFare,
      estimatedTimeInMinutes: data.estimatedTimeInMinutes,
      expirySeconds: data.expirySeconds,     // 20 seconds to respond
      attemptNumber: data.attemptNumber,
      isScheduled: data.isScheduled,
      passengerId: data.passengerId,
      driverScore: data.driverScore,
      distanceToPickupKm: data.distanceToPickupKm,
    });
  }
});
```

### 5.2 Ride Request Event Payload

```json
{
  "eventType": "driver-ride-request",
  "rideId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "rideUUId": "WG-XXXXXXXXXXXXXXXX",
  "rideType": "INSTANT",
  "pickupLocation": {
    "address": "Thamel, Kathmandu",
    "coordinates": [85.3122, 27.7153],
    "city": "Kathmandu"
  },
  "dropoffLocation": {
    "address": "Patan, Lalitpur",
    "coordinates": [85.3205, 27.6710],
    "city": "Lalitpur"
  },
  "distanceInKm": 5.2,
  "estimatedFare": 160,
  "estimatedTimeInMinutes": 18,
  "expirySeconds": 20,
  "attemptNumber": 1,
  "isScheduled": false,
  "passengerId": "64a1b2c3d4e5f6a7b8c9d0e2",
  "driverScore": 0.35,
  "distanceToPickupKm": 1.2
}
```

### 5.3 Responding to Ride Request (GraphQL Mutation)

When the driver accepts or rejects, call the `driverRespondToRide` mutation:

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

**Accept a ride:**
```json
{
  "input": {
    "rideUUID": "WG-XXXXXXXXXXXXXXXX",
    "driverId": "driver_mongo_id",
    "action": "ACCEPT"
  }
}
```

**Reject a ride:**
```json
{
  "input": {
    "rideUUID": "WG-XXXXXXXXXXXXXXXX",
    "driverId": "driver_mongo_id",
    "action": "REJECT"
  }
}
```

### 5.4 After Accepting — Subscribe to Ably Channel

After accepting a ride, use the `ablyChannelId` from the response to subscribe to the ride channel:

```javascript
// After driverRespondToRide returns
if (response.success && response.acceptedDetails) {
  const channelName = response.acceptedDetails.ablyChannelId;

  const channel = ably.channels.get(channelName);

  channel.subscribe('ride-detail', (message) => {
    const { eventType, ...data } = message.data;

    switch (eventType) {
      case 'passenger-location-update':
        // Update passenger location on map
        updatePassengerMarker(data.latitude, data.longitude);
        break;

      case 'ride-taken':
        // Another driver accepted this ride
        showRideTakenByAnotherDriver();
        break;

      case 'ride-details':
        // Full ride details update
        updateRideScreen(data);
        break;

      case 'ride-status-update':
        // Ride status changed
        updateRideStatus(data.rideStatus);
        break;
    }
  });
}
```

### 5.5 Updating Driver Location (GraphQL Mutation)

Periodically send the driver's GPS location to the server:

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
    "driverId": "driver_mongo_id",
    "latitude": 27.7153,
    "longitude": 85.3122
  }
}
```

**Recommended frequency:** Every 5-10 seconds while on an active ride.

### 5.6 Complete Driver App Flow

```
1. Driver goes ONLINE
   └── Subscribe to Ably channel: driver:{driverId}:rides

2. Ride request arrives (driver-ride-request event)
   ├── Show ride request modal with:
   │   ├── Pickup location & distance to pickup
   │   ├── Dropoff location & total distance
   │   ├── Estimated fare
   │   ├── Time limit (20 seconds countdown)
   │   └── Accept/Reject buttons
   ├── Timer starts (20 seconds)
   │
3. Driver taps ACCEPT:
   ├── Call driverRespondToRide(action: "ACCEPT")
   ├── Get ablyChannelId from response
   ├── Subscribe to ride Ably channel (ablyChannelId)
   ├── Start sending location updates (every 5-10s)
   └── Navigate to pickup screen
   OR
   Driver taps REJECT:
   └── Call driverRespondToRide(action: "REJECT")

4. Timer expires (no action):
   └── Server moves to next ring automatically

5. Active Ride:
   ├── Update location periodically
   ├── Listen for passenger-location-update events
   ├── Show navigation to pickup → dropoff
   └── Ride status updates via Ably channel
```

### 5.7 Driver App — Push Notification Handling

When a Firebase push notification arrives for a new ride request:

```javascript
// Firebase notification handler for driver
messaging.onNotification((remoteMessage) => {
  const { title, notificationType, ablyChannelId } = remoteMessage.data;

  switch (notificationType) {
    case 'RIDE_REQUEST':
      // Show ride request modal with countdown timer
      showRideRequestModal(remoteMessage.data);
      break;

    case 'RIDE_ACCEPTED':
      // Passenger accepted (not typically sent to driver)
      break;

    default:
      // Show general notification
      showNotification(title, remoteMessage.notification.body);
  }
});
```

---

## 6. Event Reference Tables

### 6.1 `driver-ride-request` — Ride Request to Driver

```json
{
  "eventType": "driver-ride-request",
  "rideId": "string",
  "rideUUId": "string",
  "rideType": "INSTANT | SCHEDULED",
  "bookingTime": "ISO date string (SCHEDULED only)",
  "pickupLocation": {
    "address": "string",
    "coordinates": [longitude, latitude],
    "city": "string"
  },
  "dropoffLocation": {
    "address": "string",
    "coordinates": [longitude, latitude],
    "city": "string"
  },
  "distanceInKm": 5.2,
  "estimatedFare": 160,
  "estimatedTimeInMinutes": 18,
  "passengerId": "string",
  "driverScore": 0.35,
  "distanceToPickupKm": 1.2,
  "expirySeconds": 20,
  "attemptNumber": 1,
  "isScheduled": false,
  "driverImage": "string or null",
  "rating": 4.5
}
```

### 6.2 `driver-accepted` — Driver Accepted the Ride

```json
{
  "eventType": "driver-accepted",
  "rideId": "string",
  "rideUUId": "string",
  "driver": {
    "driverId": "string",
    "fullName": "John Doe",
    "phone": "+977-98XXXXXXXX",
    "profileImage": "https://...",
    "rating": 4.5
  },
  "vehicle": {
    "vehicleId": "string",
    "vehicleModel": "Hyundai i10",
    "vehicleType": "CAR",
    "color": "White",
    "numberPlate": "Ba 12345",
    "year": 2020
  },
  "passenger": {
    "passengerId": "string",
    "fullName": "Jane Doe",
    "phone": "+977-98XXXXXXXX"
  },
  "pickupLocation": {
    "address": "Thamel, Kathmandu",
    "coordinates": [85.3122, 27.7153],
    "city": "Kathmandu"
  },
  "dropoffLocation": {
    "address": "Patan, Lalitpur",
    "coordinates": [85.3205, 27.6710],
    "city": "Lalitpur"
  },
  "estimatedFare": 160,
  "estimatedTimeInMinutes": 18,
  "distanceInKm": 5.2,
  "acceptedAt": "2024-01-15T10:30:00.000Z"
}
```

### 6.3 `driver-location-update` — Real-Time Driver Location

```json
{
  "eventType": "driver-location-update",
  "driverId": "string",
  "latitude": 27.7153,
  "longitude": 85.3122,
  "distanceToReachPassenger": 0.8,
  "estimatedTimeToReachPassenger": 5,
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 6.4 `passenger-location-update` — Real-Time Passenger Location

```json
{
  "eventType": "passenger-location-update",
  "passengerId": "string",
  "latitude": 27.7153,
  "longitude": 85.3122,
  "distanceToReachPassenger": 0.8,
  "estimatedTimeToReachPassenger": 5,
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 6.5 `ride-details` — Full Ride Details Update

```json
{
  "eventType": "ride-details",
  "rideId": "string",
  "rideUUId": "string",
  "rideType": "INSTANT",
  "rideStatus": "CONFIRMED",
  "bookingTime": "ISO date string",
  "pickupLocation": {
    "address": "string",
    "coordinates": [longitude, latitude],
    "city": "string"
  },
  "dropoffLocation": {
    "address": "string",
    "coordinates": [longitude, latitude],
    "city": "string"
  },
  "distanceInKm": 5.2,
  "estimatedFare": 160,
  "estimatedTimeInMinutes": 18,
  "passenger": {
    "passengerId": "string",
    "fullName": "string",
    "phone": "string",
    "profileImage": "string"
  },
  "driver": {
    "driverId": "string",
    "fullName": "string",
    "phone": "string",
    "profileImage": "string",
    "rating": 4.5
  },
  "vehicle": {
    "vehicleId": "string",
    "vehicleModel": "string",
    "vehicleType": "string",
    "color": "string",
    "numberPlate": "string",
    "year": 2020
  },
  "rideStartedAt": "ISO date string",
  "rideCompletedAt": "ISO date string",
  "updatedAt": "ISO date string"
}
```

### 6.6 `driver-accepted` Response (GraphQL Mutation)

```json
{
  "success": true,
  "message": "Ride accepted successfully",
  "ablyChannelId": "WG-RIDE-{rideUUId}-ride-details",
  "acceptedDetails": {
    "rideId": "string",
    "rideUUId": "string",
    "driverId": "string",
    "driverName": "John Doe",
    "driverImage": "https://...",
    "rating": 4.5,
    "vehicleType": "CAR",
    "vehicleModel": "Hyundai i10",
    "color": "White",
    "numberPlate": "Ba 12345",
    "estimatedFare": 160,
    "estimatedTimeInMinutes": 18,
    "distanceInKm": 5.2,
    "ablyChannelId": "WG-RIDE-{rideUUId}-ride-details"
  }
}
```

---

## 7. Error Handling & Edge Cases

### 7.1 Matchmaking Timeout

If the `matchDrivers` mutation takes longer than 120 seconds, the client should:
1. Cancel the request
2. Show "Search timed out — please try again"
3. The ride may still be matched in the background

### 7.2 No Drivers Found

When `matched: false` is returned:
1. Show "No drivers available nearby"
2. Suggest scheduling a ride for later
3. The ride is deleted from the database by the Passenger API

### 7.3 Driver Rejects / Timeout

When a driver rejects or times out during the matching process:
1. The passenger receives a `driver-rejected` event
2. The system automatically searches for the next ring of drivers
3. Show "Looking for another driver..."
4. No action needed from the passenger

### 7.4 Ride Taken by Another Driver

When `ride-taken` event is received:
1. Show "This ride was accepted by another driver"
2. Stop location updates
3. Navigate back to home screen

### 7.5 Connection Lost

If Ably connection drops:
1. Ably SDK automatically reconnects with the last known state
2. Missed messages during disconnection are NOT replayed by default
3. The client should re-fetch ride state from the API on reconnection

### 7.6 Driver Response Timeout (20s)

Each ring gives drivers 20 seconds to respond:
1. Show countdown timer in the driver app
2. If no action, the server automatically moves to the next ring
3. Driver doesn't need to explicitly reject — inaction = rejection

### 7.7 Recommended Polling Fallback

For critical state changes, consider implementing a polling fallback:

```javascript
// Poll ride status every 30 seconds as fallback
setInterval(async () => {
  const rideStatus = await queryRideStatus(rideId);
  updateUI(rideStatus);
}, 30000);
```

---

## Quick Reference — Key Channel Names

| Channel Pattern | Used By | Purpose |
|-----------------|---------|---------|
| `driver:{driverId}:rides` | Driver App | Receive ride requests |
| `WG-RIDE-{rideUUId}-ride-details` | Both Apps | All ride-related events |
| `WG-RIDE-{rideUUId}-ride-details` (via `driver-response`) | Server | Internal driver accept/reject flow |

## Quick Reference — GraphQL Endpoints

| Endpoint | Type | App | Description |
|----------|------|-----|-------------|
| `matchDrivers` | Mutation | Passenger | Trigger instant matchmaking |
| `matchScheduledDrivers` | Mutation | Passenger | Trigger scheduled matchmaking |
| `driverRespondToRide` | Mutation | Driver | Accept or reject a ride |
| `updateDriverLocation` | Mutation | Driver | Send GPS location |
| `updatePassengerLocation` | Mutation | Passenger | Send GPS location |
| `estimatedFare` | Query | Passenger | Get fare estimate |
| `getVehicleEstimates` | Query | Passenger | Get estimates for all vehicle types |
| `driverMatchFound` | Subscription | Passenger | Real-time match status |