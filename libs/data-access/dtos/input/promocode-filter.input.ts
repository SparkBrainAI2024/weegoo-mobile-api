import { PaginationInput } from "@libs/data-access/base/base.input";
import { AppliedToEnum, PromoCodeStatusEnum } from "@libs/data-access/enums/promo-code.enum";
import { Field, ID, InputType } from "@nestjs/graphql";
import { Types } from "mongoose";

@InputType()
export class PromoCodeFilterInput {
  @Field(() => PromoCodeStatusEnum, { nullable: true })
  status?: PromoCodeStatusEnum;

  @Field(() => AppliedToEnum, { nullable: true })
  appliedTo?: AppliedToEnum;

  @Field(() => ID, { nullable: true })
  occasion?: Types.ObjectId;
}

@InputType()
export class PromoCodeFindAllInput extends PaginationInput {
  @Field(() => PromoCodeFilterInput, { nullable: true })
  filter?: PromoCodeFilterInput;
}