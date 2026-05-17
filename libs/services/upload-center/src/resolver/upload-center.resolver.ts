import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@libs/guards/guard";
import { CurrentUser } from "@libs/common";
import { S3Service } from "@libs/s3";
import { UploadCenterService } from "../upload-center.service";

import { UploadPurpose } from "@libs/data-access/enums/upload.enum";
import { RequestUploadResponse } from "@libs/data-access/dtos/response/request-upload.response";
import { RequestUploadInput } from "@libs/data-access/dtos/input/request-upload.input";
import { ConfirmUploadResponse } from "@libs/data-access/dtos/response/confirm-upload.response";
import { ConfirmUploadInput } from "@libs/data-access/dtos/input/confirm-upload.input";
import { UserDetailsService } from "@libs/services/user/user.details.services";

@Resolver()
@UseGuards(AuthGuard)
export class UploadCenterResolver {
  constructor(
    private readonly uploadCenter:    UploadCenterService,
    private readonly s3:              S3Service,
    private readonly userDetails:     UserDetailsService,   // for USER_PROFILE_IMAGE
  ) {}

  // ─── STEP 1: Get presigned PUT URL ───────────────────────────────────────────
  @Mutation(() => RequestUploadResponse)
  async requestUpload(
    @CurrentUser() user: { _id: string },
    @Args("input") input: RequestUploadInput,
  ): Promise<RequestUploadResponse> {
    return this.uploadCenter.requestUpload({
      ownerId:     user._id,
      purpose:     input.purpose,
      contentType: input.contentType,
    });
  }

  // ─── STEP 2 (client): PUT file to S3 directly — no server involvement ────────

  // ─── STEP 3: Confirm — image-only, no form data ──────────────────────────────
  // Vehicle image is NOT handled here — it goes through registerVehicle mutation
  // which includes form data alongside the s3Key
  @Mutation(() => ConfirmUploadResponse)
  async confirmUpload(
    @CurrentUser() user: { _id: string },
    @Args("input") input: ConfirmUploadInput,
  ): Promise<ConfirmUploadResponse> {
    const { s3Key, purpose } = input;

    switch (purpose) {
      case UploadPurpose.USER_PROFILE_IMAGE:
       //TODO: await this.userDetails.updateProfileImage(user._id, s3Key);
        // break;

      case UploadPurpose.DRIVER_LICENSE:
      case UploadPurpose.DRIVER_BLUEBOOK:
      case UploadPurpose.DRIVER_NATIONAL_ID:
        // These need side info — handled by upsertDocumentFile, not here
        // confirmUpload for documents should not be called directly
        // keeping this for completeness but throwing a clear error
        throw new Error(
          "Use upsertDocumentFile mutation for driver document uploads",
        );

      case UploadPurpose.VEHICLE_IMAGE:
        // Vehicle image must go through registerVehicle or updateVehicleImage
        throw new Error(
          "Use registerVehicle or updateVehicleImage mutation for vehicle images",
        );

      default:
        throw new Error(`Unhandled upload purpose: ${purpose}`);
    }

    return { success: true, message: "Upload confirmed successfully" };
  }
}