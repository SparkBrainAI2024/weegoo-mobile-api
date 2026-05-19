import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { GeoLocation } from "./geo.location";
import { ProvinceEnum } from "../enums/user.enum";

@ObjectType()
export class RideLocation extends GeoLocation {
    @Field()
    @Prop({ type: String, required: true })
    @ApiProperty()
    address: string;

    @Field(() => String)
    @Prop({ type: String, required: true })
    @ApiProperty()
    city: string;

    @Field(() => ProvinceEnum)
    @Prop({ type: ProvinceEnum, required: true })
    @ApiProperty()
    province: ProvinceEnum;

    @Field(() => String)
    @Prop({ type: String, required: true })
    @ApiProperty()
    district: string;

    @Field(() => String)
    @Prop({ type: String, required: true })
    @ApiProperty()
    fullAddress: string;

}
