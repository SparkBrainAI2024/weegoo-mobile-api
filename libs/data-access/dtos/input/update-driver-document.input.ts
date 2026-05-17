import { InputType, Field, Int, PartialType } from '@nestjs/graphql';
import { CreateDriverDocumentInput } from './create-driver-document.input';

@InputType()
export class UpdateDriverDocumentInput extends PartialType(CreateDriverDocumentInput) {
  @Field(() => Int)
  id: number;
}
