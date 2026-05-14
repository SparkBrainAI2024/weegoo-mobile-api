import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@libs/guards/guard";
import { CurrentUser } from "@libs/common";
import { Field, Int, ObjectType } from "@nestjs/graphql";
import { DriverDocument } from "../entities/driver-document.entity";
import { UpsertDocumentFileInput } from "../dto/upsert-document-file.input";
import { DriverDocumentService } from "../driver-document.service";
import { SubmitDocumentForReviewInput } from "../dto/submit-for-review.input";
import { DriverDocumentSide, DriverDocumentType } from "@driver-api/enums/driver-document.enum";

@ObjectType()
class DocumentViewUrlResponse {
  @Field() url: string;
  @Field(() => Int) expiresInSeconds: number;
}

@Resolver(() => DriverDocumentResolver)
@UseGuards(AuthGuard)
export class DriverDocumentResolver {
  constructor(private readonly driverDocService: DriverDocumentService) {}

  @Mutation(() => DriverDocument)
  async upsertDocumentFile(
    @CurrentUser() user: { _id: string },
    @Args("input") input: UpsertDocumentFileInput,
  ): Promise<DriverDocument> {
    return this.driverDocService.upsertDocumentFile(user._id, input);
  }

  @Mutation(() => DriverDocument)
  async submitDocumentForReview(
    @CurrentUser() user: { _id: string },
    @Args("input") input: SubmitDocumentForReviewInput,
  ): Promise<DriverDocument> {
    return this.driverDocService.submitForReview(user._id, input);
  }

  @Query(() => [DriverDocument])
  async myDriverDocuments(
    @CurrentUser() user: { _id: string },
  ): Promise<DriverDocument[]> {
    return this.driverDocService.getMyDocuments(user._id);
  }

  @Query(() => DocumentViewUrlResponse)
  async driverDocumentFileViewUrl(
    @CurrentUser() user: { _id: string },
    @Args("documentType", { type: () => String }) documentType: DriverDocumentType,
    @Args("side",         { type: () => String }) side: DriverDocumentSide,
  ): Promise<DocumentViewUrlResponse> {
    return this.driverDocService.getDocumentViewUrl({
      driverId: user._id,
      documentType,
      side,
    });
  }
}