import { Field, ObjectType } from '@nestjs/graphql';
import { SavedLocation } from '../../common/saved-location';

@ObjectType()
export class SavedLocationsResponse {
  @Field(() => SavedLocation, { nullable: true })
  homeLocation?: SavedLocation;

  @Field(() => SavedLocation, { nullable: true })
  workLocation?: SavedLocation;
}