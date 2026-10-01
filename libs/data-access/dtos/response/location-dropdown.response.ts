import { Field, Float, ObjectType } from "@nestjs/graphql";

/**
 * Lean location payload for the rider and driver apps' location dropdown.
 * It intentionally does NOT carry the embedded sub-locations — those are
 * fetched separately (per selected location) with `locationSubLocations`.
 */
@ObjectType()
export class LocationDropdownResponse {
  @Field(() => String, { description: "Identifier of the location" })
  _id: string;

  @Field(() => String, { description: "Display name of the location" })
  name: string;

  @Field(() => Float, { description: "Latitude of the location" })
  latitude: number;

  @Field(() => Float, { description: "Longitude of the location" })
  longitude: number;
}

/**
 * Lean sub-location payload for the rider and driver apps' sub-location
 * dropdown. Only ACTIVE sub-locations of the selected location are returned.
 */
@ObjectType()
export class SubLocationDropdownResponse {
  @Field(() => String, { description: "Identifier of the sub-location" })
  _id: string;

  @Field(() => String, { description: "Address of the sub-location" })
  address: string;

  @Field(() => Float, { description: "Latitude of the sub-location" })
  latitude: number;

  @Field(() => Float, { description: "Longitude of the sub-location" })
  longitude: number;
}
