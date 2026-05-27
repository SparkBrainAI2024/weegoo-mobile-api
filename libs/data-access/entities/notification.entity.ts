import { Field } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { BaseEntity } from '../base/base.entity';
import { NotificationType } from '../enums/notification.enum';
import { roles } from '../enums/user.enum';

@Schema({ timestamps: true, autoCreate: true, autoIndex: true })
export class Notification extends BaseEntity {
    @Prop({
        required: true,
        ref: 'User',
        type: SchemaTypes.ObjectId,
    })
    userId: string;

    @Prop({ required: true, type: String, enum:roles })
    roles: string;

    @Field(() => String)
    @Prop({ required: true, type: String })
    title: string;

    @Field(() => NotificationType)
    @Prop({ type: String, enum: NotificationType, required: true })
    notificationType: NotificationType;

    @Field(() => String)
    @Prop()
    description: string;

    @Prop()
    readAt: Date;

    @Field(() => Date)
    @Prop({ default: null })
    viewedAt: Date;

    @Field(() => Boolean)
    @Prop({ type: Boolean, default: false })
    isOpen: boolean;
}

export type NotificationDocument = Notification & Document;
export const notificationSchema = SchemaFactory.createForClass(Notification);