const fs = require("fs");
const path = "apps/cron/src/modules/cron/cron.service.ts";
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

replaceThrough(
  "          const fallback = await this.ridesModel",
  ".exec();",
  (old) => {
    const route = `          // Matchmaking is unreachable in this branch, so compute the driver
          // -> dropoff ETA/distance via Baato here and persist it on the ride.
          let fallbackDistanceInKm = ride.distanceInKm ?? 0;
          let fallbackEstimatedTimeInMinutes = ride.estimatedTimeInMinutes ?? 0;
          const fallbackRoute = await this.getDriverToDropoffRoute(
            ride,
            ride.driverId!.toString(),
          );
          if (fallbackRoute) {
            fallbackDistanceInKm = fallbackRoute.distanceKm;
            fallbackEstimatedTimeInMinutes = fallbackRoute.durationMinutes;
          }
${eol}`;
    let n = old.replace(
      "          const fallback = await this.ridesModel",
      route + "          const fallback = await this.ridesModel"
    );
    n = n.replace(
      "                  rideStatus: RideStatus.ONGOING,\n                  rideStartedAt: new Date(),\n                },",
      "                  rideStatus: RideStatus.ONGOING,\n                  rideStartedAt: new Date(),\n                  distanceInKm: fallbackDistanceInKm,\n                  estimatedTimeInMinutes: fallbackEstimatedTimeInMinutes,\n                },"
    );
    return n;
  }
);

fs.writeFileSync(path, content, "utf8");
console.log("cron edit 4 OK");