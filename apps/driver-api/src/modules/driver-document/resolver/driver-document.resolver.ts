import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@libs/guards/guard";
import { CurrentLang, CurrentUser } from "@libs/common";
import { Field, Int, ObjectType } from "@nestjs/graphql";
import { DriverDocument } from "../../../../../../libs/data-access/entities/driver-document.entity";
import { DriverDocumentService } from "../driver-document.service";
import { SubmitDocumentForReviewInput } from "../../../../../../libs/data-access/dtos/input/submit-for-review.input";
import { UpsertDocumentFileInput } from "@libs/data-access/dtos/input/upsert-document-file.input";
import { DriverDocumentSide, DriverDocumentType } from "@libs/data-access/enums/driver-document.enum";
import { DriverDocumentConfirmUploadResponse } from "@libs/data-access/dtos/response/driver-document-confirm-upload.response";

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
    @CurrentLang() lang: string,
    @Args("input") input: UpsertDocumentFileInput,
  ): Promise<DriverDocumentConfirmUploadResponse> {
    return this.driverDocService.upsertDocumentFile(user._id, input,lang);
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