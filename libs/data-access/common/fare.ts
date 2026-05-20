import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
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

}
