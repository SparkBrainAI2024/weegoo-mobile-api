import { InputType, Field, ID } from '@nestjs/graphql';
import { IsMongoId, IsNotEmpty } from 'class-validator';

@InputType()
export class GetRideByIdInput {
  @Field(() => ID)
  @IsMongoId()
  @IsNotEmpty()
  rideId: string;
}