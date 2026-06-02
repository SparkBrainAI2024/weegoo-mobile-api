import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Types } from "mongoose";
@ObjectType()
export class Fare {
    @Field(() => Number)
    @Prop({ type: Number, default: 0, required: true })
    @ApiProperty({ nullable: false })
    baseAmount: Number;

    @Field(() => Number)
    @Prop({ type: Number, default: 0, required: true })
    @ApiProperty({ nullable: false })
    trafficCongestionAmount: Number;

    @Field(() => Number)
    @Prop({ type: Number, default: 0, required: true })
    @ApiProperty({ nullable: false })
    distanceAmount: Number;

    @Field(() => Number)
    @Prop({ type: Number, default: 0, required: true })
    @ApiProperty({ nullable: false })
    totalAmount: Number;

    @Field(() => Number)
    @Prop({ type: Number, default: 0, required: true })
    @ApiProperty({ nullable: false })
    noOfPassengers: Number;


    @Field(() => Number)
    @Prop({ type: Number, default: 0, required: true })
    @ApiProperty({ nullable: false })
    discountAmount: Number;

    @Field(() => String, { nullable: true })
    @Prop({ type: Types.ObjectId, ref: 'PromoCode', default: null })
    @ApiProperty({ nullable: true })
    promoCodeId?: Types.ObjectId;

}
