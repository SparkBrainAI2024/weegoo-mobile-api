import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";

export type Coordinates = [number, number];
@ObjectType()
export class GeoLocation {
  @Field({ nullable: true })
  @Prop({ type: String, enum: ["Point"], default: "Point", required: true })
  @ApiProperty()
  type: string;

  @Field(() => [Number])
  @Prop({ type: [Number], required: true })
  @ApiProperty({ type: [Number], example: [-74.0, 40.71] })
  coordinates: [number, number];
}
