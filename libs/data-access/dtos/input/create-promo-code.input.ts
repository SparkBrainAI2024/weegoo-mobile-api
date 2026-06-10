import { Field, InputType, ID } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsDate, IsMongoId } from 'class-validator';
import { DiscountTypeEnum, AppliedToEnum, PromoCodeStatusEnum } from '@libs/data-access';
import { Type } from 'class-transformer';

@InputType()
export class OccasionInput {
  @Field({ description: 'The type of occasion, e.g., "HOLIDAY", "EVENT"' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @Field(() => ID, { description: 'The specific ID of the occasion entity' })
  @IsNotEmpty()
  occasionId: string;
}

@InputType()
export class CreatePromoCodeInput {
  @Field(() => OccasionInput, { nullable: true })
  @IsOptional()
  @Type(() => OccasionInput)
  occasion?: OccasionInput;

  @Field({ description: 'The alphanumeric code name, e.g., "WELCOME50"' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field(() => DiscountTypeEnum, { description: 'Whether the discount is a percentage or flat amount' })
  @IsEnum(DiscountTypeEnum)
  discountType: DiscountTypeEnum;

  @Field({ nullable: true, description: 'Percentage value (0-100) if discountType is PERCENTAGE' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentageAmount?: number;

  @Field({ nullable: true, description: 'Fixed currency amount if discountType is FLAT' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatAmount?: number;

  @Field({ nullable: true, description: 'Cap on the discount amount for percentage-based promos' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @Field({ nullable: true, description: 'Minimum ride fare required to apply this code' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumFare?: number;

  @Field(() => AppliedToEnum, { defaultValue: AppliedToEnum.ALL_RIDES })
  @IsEnum(AppliedToEnum)
  appliedTo: AppliedToEnum;

  @Field({ defaultValue: 1, description: 'Maximum number of times this code can be used in total' })
  @IsNumber()
  @Min(1)
  totalUsageLimit: number;

  @Field({ defaultValue: 1, description: 'Maximum number of times a single user can use this code' })
  @IsNumber()
  @Min(1)
  perUserLimit: number;

  @Field({ description: 'When the promo code becomes valid' })
  @IsDate()
  @Type(() => Date)
  startDateTime: Date;

  @Field({ description: 'When the promo code expires' })
  @IsDate()
  @Type(() => Date)
  expiryDateTime: Date;

  @Field(() => PromoCodeStatusEnum, { defaultValue: PromoCodeStatusEnum.ACTIVE })
  @IsEnum(PromoCodeStatusEnum)
  status: PromoCodeStatusEnum;


  @Field(()=>ID)
  @IsMongoId()
  occasionId:string
}