import { Field, InputType } from '@nestjs/graphql';
import { IsEnum } from 'class-validator';
import { SavedLocationType } from '../../enums/user.enum';

@InputType()
export class DeleteLocationInput {
  @Field(() => SavedLocationType)
  @IsEnum(SavedLocationType)
  locationType: SavedLocationType;
}