import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Types } from "mongoose";
@ObjectType()
export class Fare {
    @Field(() => Number,{defaultValue: 0})
    @Prop({ type: Number, default: 0, required: false,nullable:true })
    @ApiProperty({ nullable: false })
    baseAmount: Number;

   @Field(() => Number,{defaultValue: 0})
    @Prop({ type: Number, default: 0, required: false,nullable:true })
    @ApiProperty({ nullable: false })
    trafficCongestionAmount: Number;

    @Field(() => Number,{defaultValue: 0})
    @Prop({ type: Number, default: 0, required: false,nullable:true })
    @ApiProperty({ nullable: false })
    distanceAmount: Number;

    @Field(() => Number,{defaultValue: 0})
    @Prop({ type: Number, default: 0, required: false,nullable:true })
    @ApiProperty({ nullable: false })
    totalAmount: Number;

    @Field(() => Number,{defaultValue: 1})
    @Prop({ type: Number, default: 1, required: false,nullable:true })
    @ApiProperty({ nullable: false })
    noOfPassengers: Number;


    @Field(() => Number,{defaultValue: 0})
    @Prop({ type: Number, default: 0, required: false,nullable:true })
    @ApiProperty({ nullable: false })
    discountAmount: Number;

    @Field(() => String, { nullable: true })
    @Prop({ type: Types.ObjectId, ref: 'PromoCode', default: null })
    @ApiProperty({ nullable: true })
    promoCodeId?: Types.ObjectId;

}
