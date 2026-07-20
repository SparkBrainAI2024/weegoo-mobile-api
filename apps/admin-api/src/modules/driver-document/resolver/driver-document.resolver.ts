import {
  Args,
  Mutation,
  Query,
  Resolver,
  ResolveField,
  Parent,
} from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@libs/guards/guard";
import { CurrentLang, CurrentUser } from "@libs/common";
import { Field, Int, ObjectType } from "@nestjs/graphql";
import { UpsertDocumentFileInput } from "@libs/data-access/dtos/input/upsert-document-file.input";
import {
  DriverDocumentSide,
  DriverDocumentType,
} from "@libs/data-access/enums/driver-document.enum";
import { DriverDocumentConfirmUploadResponse } from "@libs/data-access/dtos/response/driver-document-confirm-upload.response";
import { DriverDocument } from "@libs/data-access/entities/driver-document.entity";
import { SubmitDocumentForReviewInput } from "@libs/data-access/dtos/input/submit-for-review.input";
import { DocumentViewUrlResponse } from "@libs/data-access/dtos/response/driver-document.response";
import { ApproveDocumentFileInput } from "@libs/data-access/dtos/input/approve-document-file.input";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { RejectDocumentFileInput } from "@libs/data-access/dtos/input/reject-document-file.input";
import { DriverDocumentService } from "@libs/services/driver-document/driver-document.service";

@Resolver(() => DriverDocument) // fixed: points to the entity, not itself
@UseGuards(AdminAuthGuard)
export class DriverDocumentResolver {
  constructor(private readonly driverDocService: DriverDocumentService) {}

  // @UseGuards(AdminAuthGuard)
  @Mutation(() => DriverDocument)
  approveDriverDocumentFile(
    @Args("input") input: ApproveDocumentFileInput,
    @CurrentUser() admin: { id: string },
  ) {
    console.log(input, "input");

    return this.driverDocService.approveDocumentFile(
      input.documentFileId,
      admin.id,
    );
  }

  // @UseGuards(AdminAuthGuard)
  @Mutation(() => DriverDocument)
  rejectDriverDocumentFile(
    @Args("input") input: RejectDocumentFileInput,
    @CurrentUser() admin: { id: string },
  ) {
    return this.driverDocService.rejectDocumentFile(
      input.documentFileId,
      admin.id,
      input.rejectionReason,
    );
  }
}
