import { Field, InputType } from "@nestjs/graphql";
import { IsMongoId } from "class-validator";

@InputType()
export class DeletePassengerInput {
  @Field(() => String)
  @IsMongoId()
  passengerId: string;
}
