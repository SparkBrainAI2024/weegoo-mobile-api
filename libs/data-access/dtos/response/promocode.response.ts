import { Field, ObjectType } from "@nestjs/graphql";
import { BasicResponse } from "./basic.response";
import { PromoCode } from "@libs/data-access/entities/promo-code.entity";

@ObjectType()
export class PromocodeUpdateResponse extends BasicResponse {
  @Field(() => PromoCode)
  promocode: PromoCode;
}

@ObjectType()
export class PromocodeCreateResponse extends BasicResponse {
  @Field(() => PromoCode)
  promocode: PromoCode;
}
