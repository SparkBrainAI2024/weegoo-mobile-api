import { Field, InputType } from "@nestjs/graphql";
import { IsMongoId } from "class-validator";

@InputType()
export class DeleteDriverInput {
  @Field(() => String)
  @IsMongoId()
  driverId: string;
}
