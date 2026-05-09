import { ObjectType, Field, ID } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, HydratedDocument, Types } from "mongoose";
import { deviceType } from "../enums/user.enum";
import { BaseEntity } from "../base/base.entity";

export type DeviceDocument = HydratedDocument<Device>;

@ObjectType()
@Schema({ timestamps: true })
export class Device extends BaseEntity{

    @Field(() => ID)
    @Prop({
        type: Types.ObjectId,
        index: true,
        required: true,
        ref: "User",
    })
    userId: Types.ObjectId;

    @Field(() => String)
     @Prop({
        type: String,
    })
    deviceId: string;

    @Field({ nullable: true })
    @Prop({
        type: String,
    })
    firebaseToken: string;

    @Field(() => deviceType, { defaultValue: deviceType.ANDROID })
    @Prop({
        type: String,
        enum: deviceType,
        default: deviceType.ANDROID,
        uppercase: true,
    })
    deviceType: string;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
export const deviceModel = {
  name: Device.name,
  schema: DeviceSchema,
};