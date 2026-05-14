import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateDriverDocumentInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
