import { AppliedToEnum, DiscountTypeEnum } from "@libs/data-access/enums/promo-code.enum";
import { Field, Float, ID, InputType, Int } from "@nestjs/graphql";
import { IsDate, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from "class-validator";

@InputType()
export class UpdatePromoCodeInput {
  @Field(() => ID)
  @IsMongoId()
  occasionId: string;

  @Field(() => String)
  @IsString()
  name: string;

  @Field(() => DiscountTypeEnum)
  @IsEnum(DiscountTypeEnum)
  discountType: DiscountTypeEnum;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentageAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatAmount?: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  maxDiscount: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  minimumFare: number;

  @Field(() => AppliedToEnum)
  @IsEnum(AppliedToEnum)
  appliedTo: AppliedToEnum;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  totalUsageLimit: number;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  perUserLimit: number;

  @Field(() => Date)
  @IsDate()
  startDateTime: Date;

  @Field(() => Date)
  @IsDate()
  expiryDateTime: Date;
}