import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BasicResult {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;
}