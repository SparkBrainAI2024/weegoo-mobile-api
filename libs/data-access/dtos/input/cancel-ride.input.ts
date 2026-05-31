import { InputType, Field, ID } from '@nestjs/graphql';
import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

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

  @Field(()=>String, { nullable: true })
  @ValidateIf((o) => o.cancelSubCategoryLabel === 'OTHER')
  @IsString()
    @IsNotEmpty({ message: 'RIDE.CANCEL_REASON_REQUIRED_FOR_OTHER' })
  cancelReasonContent?: string;
}


