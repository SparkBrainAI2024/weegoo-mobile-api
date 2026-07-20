import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class ApproveDocumentFileInput {
  @Field(() => String)
  documentFileId: string;
}
