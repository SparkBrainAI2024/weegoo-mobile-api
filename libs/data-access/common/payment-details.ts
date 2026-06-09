import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Types } from "mongoose";
import { PaymentMethodEnum } from "../enums/payment.enum";
@ObjectType()
export class PaymentDetails {
    @Field(() => Number,{defaultValue: 0})
    @Prop({ type: Number, default: 0, required: false,nullable:true })
    @ApiProperty({ nullable: false })
    baseAmount: Number;

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

    @Field(() => PaymentMethodEnum, { nullable: true })
    @Prop({ type: String, required: false })
    @ApiProperty({ nullable: true })
    paymentMethod?: PaymentMethodEnum;

    @Field(() => Number,{defaultValue: 0})
    @Prop({ type: Number, default: 0, required: false,nullable:true })
    @ApiProperty({ nullable: false })
    discountAmount: Number;

    @Field(() => String, { nullable: true })
    @Prop({ type: Types.ObjectId, ref: 'PromoCode', default: null })
    @ApiProperty({ nullable: true })
    promoCodeId?: Types.ObjectId;

    @Field(() => Number,{defaultValue:0.2})
    @Prop({ type: Number, default: 0.2, required: false,nullable:true })
    @ApiProperty({ nullable: false })
    driverCommission: Number;
}
