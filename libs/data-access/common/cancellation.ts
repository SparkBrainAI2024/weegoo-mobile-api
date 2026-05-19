import { Field, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { CancellationByEnum } from "../enums/cancellation.enum";

@ObjectType()
export class Cancellation {
  @Field(()=>CancellationByEnum)
  @Prop({ type: String, enum: CancellationByEnum, required: true })
  cancellationBy: string;

  @Field(() => String)
  @Prop({ type: Types.ObjectId, required: true, ref: "User", index: true })
  userId: Types.ObjectId;

  @Field(() => Date)
  @Prop({ type: Date, required: true })
  cancelledAt: Date;


  //To Do store the reason id and other if other is selected then store the reason in another field.
  @Field(() => String, { nullable: true })
  @Prop({ type: String, required: false })
  cancellationReason?: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: String, required: false })
  cancellationOtherReason?: string;
  
}
