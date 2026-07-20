import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class RejectDocumentFileInput {
  @Field(() => String)
  documentFileId: string;

  @Field(() => String)
  rejectionReason: string;
}
