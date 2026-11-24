const fs = require("fs");
const path = "apps/cron/src/modules/cron/cron.service.ts";
let content = fs.readFileSync(path, "utf8");
const eol = content.includes("\r\n") ? "\r\n" : "\n";

function replaceUntil(marker, transform) {
  const s = content.indexOf(marker);
  if (s < 0) throw new Error("marker not found: " + marker);
  const oldChunk = "";
  const newChunk = transform(oldChunk, eol);
  if (newChunk === oldChunk) throw new Error("transform unchanged for " + marker);
  content = content.slice(0, s) + newChunk + content.slice(s);
}

replaceUntil(
  "  /**" + eol + "   * When a driver is force-marked offline",
  () => {
    const helpers = `  /**
   * Road distance & duration from the driver's current location to the ride's
   * dropoff via the Baato routing API (same contract used by
   * passenger-payment's getBaatoRoute and matchmaking's DistanceCalculator).
   * Coordinates are [longitude, latitude]. Falls back to haversine when Baato
   * is not configured or the request fails; returns null when the driver's
   * location or the dropoff location is unavailable.
   */
  private async getDriverToDropoffRoute(
    ride: RidesDocument,
    driverId: string,
  ): Promise<{ distanceKm: number; durationMinutes: number } | null> {
    const driverDetails = await this.userDetailsModel
      .findOne({ userId: new Types.ObjectId(driverId) }).exec();
    const driverCoords = driverDetails?.geoLocation?.coordinates;
    const dropoffCoords = ride.dropoffLocation?.coordinates;
    if (driverCoords?.length !== 2 || dropoffCoords?.length !== 2) {
      return null;
    }
    const driverLat = driverCoords[1];
    const driverLng = driverCoords[0];
    const dropoffLat = dropoffCoords[1];
    const dropoffLng = dropoffCoords[0];
    const apiKey = this.envService.getBaatoApiKey();
    const baseUrl = this.envService.getBaatoApiUrl();
    if (!apiKey || !baseUrl) {
      this.logger.warn("Baato API not configured. Using haversine fallback.");
      return this.haversineEstimate(driverLat, driverLng, dropoffLat, dropoffLng);
    }
    try {
      const params = new URLSearchParams();
      params.append("key", apiKey);
      params.append("points[]", \`\${driverLat},\${driverLng}\`);
      params.append("points[]", \`\${dropoffLat},\${dropoffLng}\`);
      params.append("mode", "car");
      const response = await axios.get(\`\${baseUrl}/directions\`, { params });
      const route = response.data?.data?.[0];
      if (route && route.distanceInMeters != null) {
        const distanceKm = Number((route.distanceInMeters / 1000).toFixed(2));
        const durationMinutes =
          route.timeInMs != null
            ? Math.max(1, Math.ceil(route.timeInMs / 1000 / 60))
            : this.estimateDurationMinutes(distanceKm);
        return { distanceKm, durationMinutes };
      }
      this.logger.warn(
        \`Baato returned no routes for ride \${ride.rideUUId} (\${driverLat},\${driverLng} -> \${dropoffLat},\${dropoffLng}). Using haversine fallback.\`,
      );
      return this.haversineEstimate(driverLat, driverLng, dropoffLat, dropoffLng);
    } catch (error: any) {
      const detail = error?.response?.data ? JSON.stringify(error.response.data) : error?.message;
      this.logger.error(\`Baato API error for ride \${ride.rideUUId}: \${detail}. Using haversine fallback.\`);
      return this.haversineEstimate(driverLat, driverLng, dropoffLat, dropoffLng);
    }
  }

  /** Haversine distance/duration fallback when Baato is unavailable. */
  private haversineEstimate(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): { distanceKm: number; durationMinutes: number } {
    const distanceKm = Number(this.haversineKm(originLat, originLng, destLat, destLng).toFixed(2));
    return { distanceKm, durationMinutes: this.estimateDurationMinutes(distanceKm) };
  }

  /** Average urban speed ~30 km/h; minimum 5 minutes. */
  private estimateDurationMinutes(distanceKm: number): number {
    return Math.max(5, Math.ceil((distanceKm / 30) * 60));
  }

  /** Great-circle distance (km) between two coordinate pairs. */
  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
${eol}`;
    return helpers;
  }
);

fs.writeFileSync(path, content, "utf8");
console.log("cron edit 5 OK");