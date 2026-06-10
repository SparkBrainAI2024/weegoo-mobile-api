import { AppliedToEnum, DiscountTypeEnum } from "@libs/data-access/enums/promo-code.enum";
import { Field, Float, ID, InputType, Int, PartialType } from "@nestjs/graphql";
import { IsDate, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { CreatePromoCodeInput } from "./create-promo-code.input";

@InputType()
export class UpdatePromoCodeInput extends PartialType(CreatePromoCodeInput) {
  
}