import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Types } from "mongoose";
import { PaymentMethodEnum } from "../enums/payment.enum";
@ObjectType()
export class PaymentDetails {
    @Field(() => Number)
    @Prop({ type: Number, default: 0, required: true })
    @ApiProperty({ nullable: false })
    baseAmount: Number;

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

    @Field(() => PaymentMethodEnum, { nullable: true })
    @Prop({ type: String, required: false })
    @ApiProperty({ nullable: true })
    paymentMethod?: PaymentMethodEnum;

    @Field(() => Number)
    @Prop({ type: Number, default: 0, required: true })
    @ApiProperty({ nullable: false })
    discountAmount: Number;

    @Field(() => String, { nullable: true })
    @Prop({ type: Types.ObjectId, ref: 'PromoCode', default: null })
    @ApiProperty({ nullable: true })
    promoCodeId?: Types.ObjectId;

    @Field(() => Number,{defaultValue:0.2})
    @Prop({ type: Number, default: 0.2, required: false })
    @ApiProperty({ nullable: false })
    driverCommission: Number;
}
