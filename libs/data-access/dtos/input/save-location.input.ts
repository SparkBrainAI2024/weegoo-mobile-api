import { Field, InputType, Float } from '@nestjs/graphql';
import { IsEnum, IsNumber, IsString } from 'class-validator';
import { SavedLocationType } from '../../enums/user.enum';

@InputType()
export class SaveLocationInput {
  @Field(() => SavedLocationType)
  @IsEnum(SavedLocationType)
  locationType: SavedLocationType;

  @Field(() => String)
  @IsString()
  address: string;

  @Field(() => Float)
  @IsNumber()
  latitude: number;

  @Field(() => Float)
  @IsNumber()
  longitude: number;
}