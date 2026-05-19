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


}