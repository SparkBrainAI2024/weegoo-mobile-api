import { InputType, Field, ID } from '@nestjs/graphql';
import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class CancelRideInput {
  @Field(() => ID)
  @IsMongoId()
  @IsNotEmpty()
  rideId: string;


@Field(() => String)
@IsString({ message: "USER.SHOULD_STRING" })
@IsNotEmpty({ message: "USER.SHOULDNOT_EMPTY" })
  cancelSubCategoryLabel: string;

  @Field(() => ID)
  @IsMongoId()
  @IsNotEmpty()
  cancelSubCategoryId: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  cancelReasonContent?: string;
}