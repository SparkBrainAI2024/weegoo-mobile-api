import { Field, InputType } from "@nestjs/graphql";
import { IsMongoId, IsNotEmpty } from "class-validator";

@InputType()
export class RideDetailInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsMongoId()
  id: string;
}
