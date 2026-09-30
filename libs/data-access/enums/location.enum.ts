import { registerEnumType } from "@nestjs/graphql";

/**
 * Active/inactive status of a {@link Location}.
 * INACTIVE locations are kept for historical reference but must not be
 * offered for selection.
 */
export enum LocationStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

registerEnumType(LocationStatus, {
  name: "LocationStatus",
  description: "Active/inactive status of a location",
  valuesMap: {
    ACTIVE: { description: "The location is active and selectable" },
    INACTIVE: { description: "The location is deactivated and hidden" },
  },
});
