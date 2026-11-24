const fs = require("fs");
const path = "apps/ride-matchmaking/src/modules/matchmaking/matchmaking.service.ts";
let content = fs.readFileSync(path, "utf8");
const eol = content.includes("\r\n") ? "\r\n" : "\n";

function replaceThrough(marker, endMarker, transform) {
  const s = content.indexOf(marker);
  if (s < 0) throw new Error("marker not found: " + marker);
  const e = content.indexOf(endMarker, s);
  if (e < 0) throw new Error("end marker not found: " + endMarker);
  const oldChunk = content.slice(s, e + endMarker.length);
  const newChunk = transform(oldChunk, eol);
  if (newChunk === oldChunk) throw new Error("transform unchanged for " + marker);
  content = content.slice(0, s) + newChunk + content.slice(e + endMarker.length);
}

function replaceUntil(marker, endMarker, transform) {
  const s = content.indexOf(marker);
  if (s < 0) throw new Error("marker not found: " + marker);
  const c = content.indexOf(endMarker, s);
  if (c < 0) throw new Error("end marker not found: " + endMarker);
  const oldChunk = content.slice(s, c);
  const newChunk = transform(oldChunk, eol);
  if (newChunk === oldChunk) throw new Error("transform unchanged for " + marker);
  content = content.slice(0, s) + newChunk + content.slice(c);
}

replaceThrough(
  "      if (ride.rideStartedAt) {",
  ".exec();",
  (old) => {
    const baato = `      // Baato driver -> dropoff ETA/distance, persisted on the ride.
      let distanceInKm = ride.distanceInKm ?? 0;
      let estimatedTimeInMinutes = ride.estimatedTimeInMinutes ?? 0;
      const driverDetails = await this.userDetailsModel
        .findOne({ userId: new Types.ObjectId(driverId) }).exec();
      const driverCoords = driverDetails?.geoLocation?.coordinates;
      const dropoffCoords = ride.dropoffLocation?.coordinates;
      if (driverCoords?.length === 2 && dropoffCoords?.length === 2) {
        const [driverLng, driverLat] = driverCoords as [number, number];
        const [dropoffLng, dropoffLat] = dropoffCoords as [number, number];
        const route = await this.distanceCalculator.calculateDistance(
          driverLat, driverLng, dropoffLat, dropoffLng,
          ride.schedule?.vehicleType ?? VehicleType.CAR,
        );
        distanceInKm = route.distanceKm;
        estimatedTimeInMinutes = route.durationMinutes;
      }${eol}`;
    let n = old.replace("      const updatedRide =", baato + "      const updatedRide =");
    n = n.replace(
      "$set: { rideStatus: RideStatus.ONGOING, rideStartedAt: new Date() },",
      `$set: {${eol}              rideStatus: RideStatus.ONGOING,${eol}              rideStartedAt: new Date(),${eol}              distanceInKm,${eol}              estimatedTimeInMinutes,${eol}            },`
    );
    return n;
  }
);

replaceThrough(
  "      const now = new Date();",
  ".exec();",
  (old) => {
    const baato = `      // Baato driver -> dropoff ETA/distance, persisted on the ride.
      const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
      let distanceInKm = ride?.distanceInKm ?? 0;
      let estimatedTimeInMinutes = ride?.estimatedTimeInMinutes ?? 0;
      if (ride) {
        const driverDetails = await this.userDetailsModel
          .findOne({ userId: ride.driverId }).exec();
        const driverCoords = driverDetails?.geoLocation?.coordinates;
        const dropoffCoords = ride.dropoffLocation?.coordinates;
        if (driverCoords?.length === 2 && dropoffCoords?.length === 2) {
          const [driverLng, driverLat] = driverCoords as [number, number];
          const [dropoffLng, dropoffLat] = dropoffCoords as [number, number];
          const route = await this.distanceCalculator.calculateDistance(
            driverLat, driverLng, dropoffLat, dropoffLng,
            ride.schedule?.vehicleType ?? VehicleType.CAR,
          );
          distanceInKm = route.distanceKm;
          estimatedTimeInMinutes = route.durationMinutes;
        }
      }${eol}`;
    let n = old.replace("      const now = new Date();", "      const now = new Date();" + eol + baato);
    n = n.replace(
      "{ $set: { rideStatus: RideStatus.ONGOING, rideStartedAt: now } },",
      `{${eol}            $set: {${eol}              rideStatus: RideStatus.ONGOING,${eol}              rideStartedAt: now,${eol}              distanceInKm,${eol}              estimatedTimeInMinutes,${eol}            },${eol}          },`
    );
    return n;
  }
);

replaceUntil(
  "      await this.publishScheduledRideOngoingDetails(updated);",
  "      // Subscribe (or resubscribe) the driver's personal location channel so",
  (old) => {
    const notify = `      // Passenger notification using the Baato-updated distance / ETA.
      const passenger = await this.userModel.findById(updated.passengerId).exec();
      if (passenger) {
        await this.notificationService.createNotification(
          {
            title: "Ride has started",
            notificationType: NotificationType.RIDE_START,
            description: \`Your scheduled ride has started. Remaining distance: \${updated.distanceInKm ?? 0} km. Estimated time: \${updated.estimatedTimeInMinutes ?? 0} minutes.\`,
            ablyChannelId: updated.ablyChannelId || \`WG-RIDE-\${updated.rideUUId}-ride-details\`,
            rideId: updated._id.toString(),
            pickupLocation: updated.pickupLocation,
            dropoffLocation: updated.dropoffLocation,
            distanceInKm: updated.distanceInKm ?? 0,
            estimatedTimeInMinutes: updated.estimatedTimeInMinutes ?? 0,
            passengerSnapshot: {
              fullName: passenger.fullName || "Passenger",
              phone: passenger.phone || "", profileImage: "", rating: 0,
            },
          },
          passenger,
        );
      }${eol}`;
    return old + notify;
  }
);

fs.writeFileSync(path, content, "utf8");
console.log("matchmaking.service.ts edits OK");