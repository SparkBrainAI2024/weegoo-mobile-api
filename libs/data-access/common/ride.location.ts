import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { GeoLocation } from "./geo.location";
import { ProvinceEnum } from "../enums/user.enum";

@ObjectType()
export class RideLocation extends GeoLocation {
    @Field(() => String, { nullable: true })
    @Prop({ type: String, required: false })
    @ApiProperty({ required: false })
    address?: string;

    @Field(() => String, { nullable: true })
    @Prop({ type: String, required: false })
    @ApiProperty({ required: false })
    city?: string;

    @Field(() => ProvinceEnum, { nullable: true })
    @Prop({ type: ProvinceEnum, required: false })
    @ApiProperty({ required: false })
    province?: ProvinceEnum;

    @Field(() => String, { nullable: true })
    @Prop({ type: String, required: false })
    @ApiProperty({ required: false })
    district?: string;

    @Field(() => String, { nullable: true })
    @Prop({ type: String, required: false })
    @ApiProperty({ required: false })
    fullAddress?: string;

}