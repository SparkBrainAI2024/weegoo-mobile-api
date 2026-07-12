// dto/toggle-block-driver.input.ts
import { Field, InputType } from "@nestjs/graphql";
import { IsBoolean, IsMongoId } from "class-validator";

@InputType()
export class ToggleBlockDriverInput {
  @Field()
  @IsMongoId()
  id: string;

  @Field()
  @IsBoolean()
  isBlocked: boolean;
}
