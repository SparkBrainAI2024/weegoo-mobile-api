/**
 * Vehicle-type filtering for the SCHEDULED (booking) matchmaking flow
 * (`requestScheduledRide` → `matchScheduledDrivers`).
 *
 * The ADMIN pricings (`adminRidePricing.isEnabled`) are the single source of
 * truth for whether a vehicle type is currently offered:
 *  - passenger requested a type  → it must be ENABLED, and only availabilities
 *    of that exact type are returned;
 *  - no type requested           → only availabilities whose vehicle type is
 *    ENABLED are returned.
 *
 * Kept dependency-free (no NestJS/Mongoose/enum imports) so it can be
 * unit-tested in isolation, mirroring `seat-calculator.util.ts`.
 */

/** SCHEDULED vehicle types bookable by a passenger (JEEP, CAR, MICRO). */
export const SCHEDULED_VEHICLE_TYPES = ["JEEP", "CAR", "MICRO"] as const;

/** Resolved, admin-approved vehicle-type scope for a scheduled search. */
export type ScheduledVehicleTypeFilter = {
  /**
   * False when the request cannot be served: the requested type is disabled,
   * or no SCHEDULED vehicle type is enabled at all.
   */
  ok: boolean;
  /** Human-readable reason when `ok` is false (empty string otherwise). */
  message: string;
  /** Vehicle types the search may run against (enabled, narrowed by request). */
  vehicleTypes: string[];
  /** EVERY vehicle type currently enabled by the admin. */
  enabledVehicleTypes: Set<string>;
  /** The exact type requested by the passenger, or null when unspecified. */
  requestedVehicleType: string | null;
};

/**
 * Resolves which vehicle types a scheduled search may use.
 *
 * NOTE: a single (non-union) result shape is used on purpose — the repository
 * compiles with `strictNullChecks: false`, where discriminated-union narrowing
 * is unreliable.
 *
 * @param enabledVehicleTypes vehicle types with an ACTIVE (enabled, not
 *   deleted) admin pricing row.
 * @param requestedVehicleType optional type asked for by the passenger.
 */
export function resolveScheduledVehicleTypeFilter(
  enabledVehicleTypes: Iterable<string>,
  requestedVehicleType?: string | null,
): ScheduledVehicleTypeFilter {
  const enabled = new Set<string>(enabledVehicleTypes);
  const base = {
    enabledVehicleTypes: enabled,
    requestedVehicleType: requestedVehicleType ?? null,
  };

  if (requestedVehicleType) {
    // A requested type must be enabled in the admin pricings — otherwise the
    // request cannot be served at all.
    if (!enabled.has(requestedVehicleType)) {
      return {
        ...base,
        ok: false,
        message: `Vehicle type ${requestedVehicleType} is currently disabled. Please select an enabled vehicle type.`,
        vehicleTypes: [],
      };
    }
    return {
      ...base,
      ok: true,
      message: "",
      vehicleTypes: [requestedVehicleType],
    };
  }

  const vehicleTypes = SCHEDULED_VEHICLE_TYPES.filter((type) =>
    enabled.has(type),
  );
  if (vehicleTypes.length === 0) {
    return {
      ...base,
      ok: false,
      message:
        "No scheduled vehicle types are currently enabled. Please try again later.",
      vehicleTypes: [],
    };
  }
  return {
    ...base,
    ok: true,
    message: "",
    vehicleTypes: [...vehicleTypes],
  };
}

/**
 * Whether an availability day (or driver vehicle) of `vehicleType` may take
 * part in the search: it must be ENABLED in the admin pricings and, when the
 * passenger requested a type, be exactly that type.
 */
export function isVehicleTypeAllowed(
  vehicleType: string | null | undefined,
  filter?: ScheduledVehicleTypeFilter | null,
): boolean {
  if (!filter || !filter.ok) return false;
  if (!vehicleType || !filter.enabledVehicleTypes.has(vehicleType)) return false;
  if (filter.requestedVehicleType && vehicleType !== filter.requestedVehicleType)
    return false;
  return true;
}
