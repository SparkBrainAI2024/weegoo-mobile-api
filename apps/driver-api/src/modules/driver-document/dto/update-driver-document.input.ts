import { CreateDriverDocumentInput } from './create-driver-document.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateDriverDocumentInput extends PartialType(CreateDriverDocumentInput) {
  @Field(() => Int)
  id: number;
}
