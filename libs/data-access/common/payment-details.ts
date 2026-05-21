import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
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

    /**Too do to add promocode or offer id if applied */
    @Field(() => Number)
    @Prop({ type: Number, default: 0, required: true })
    @ApiProperty({ nullable: false })
    discountAmount: Number;

}
