import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { deactivateSideFiles, ErrorException, findActiveFileBySide, REQUIRED_SIDES } from "@libs/common";
import { S3Service } from "@libs/s3";

import {
  VIEW_URL_EXPIRES_ADMIN_SECONDS,
  VIEW_URL_EXPIRES_DRIVER_SECONDS,
} from "@libs/s3/s3.constants";

import { DocumentFileStatus } from "@libs/data-access/enums/upload.enum";


import { SubmitDocumentForReviewInput } from "../../../../../libs/data-access/dtos/input/submit-for-review.input";
import { DriverDocumentRepository } from "../../../../../libs/data-access/repositories/driver-document.repository";
import { UpsertDocumentFileInput } from "@libs/data-access/dtos/input/upsert-document-file.input";
import { DriverDocumentBundleStatus, DriverDocumentSide, DriverDocumentType } from "@libs/data-access/enums/driver-document.enum";
import { Message } from "@libs/localization";
import { BasicResponse } from "@libs/data-access/dtos/response/basic.response";
import { log } from "console";
import { DriverDocumentConfirmUploadResponse } from "@libs/data-access/dtos/response/driver-document-confirm-upload.response";



@Injectable()
export class DriverDocumentService {
  constructor(
    private readonly repository: DriverDocumentRepository,
    private readonly s3: S3Service,
  ) {}

  // ─── Upsert document ──────────────────────────────────────────────────────────
async upsertDocumentFile(
    driverId: string,
    input: UpsertDocumentFileInput,
    lang: string,
  ): Promise<DriverDocumentConfirmUploadResponse> {
    try {
      // Check if there is an entry for the doctype for the driver
      let doc = await this.repository.findByDriverAndType(
        driverId,
        input.documentType,
      );

      // If not, create draft with empty files array
      if (!doc) {
        doc = await this.repository.createDraftDocument(
          driverId,
          input.documentType,
        );
      }

      // If all sides are approved, the document will have APPROVED status.
      // In that case we should not allow upload of a new file without admin
      // rejecting the document first and the driver re-uploading with changes.
      if (doc.status === DriverDocumentBundleStatus.APPROVED) {
        ErrorException(
          null,
          "DRIVER_DOCUMENT.ALREADY_APPROVED",
          HttpStatus.BAD_REQUEST,
        );
      }

      // There is an array of files for each side. We mark the previous active
      // file for the given side as inactive, then push the new file as active.
      // This preserves the full upload history per side.
      doc.files = deactivateSideFiles(doc.files, input.side);

      doc.files.push({
        side: input.side,
        s3Key: input.s3Key,
        isActive: true,
        status: DocumentFileStatus.PENDING,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: new Date(),
      });

      // If the document was previously rejected, reset to DRAFT so it
      // re-enters the admin review queue.
      if (doc.status === DriverDocumentBundleStatus.REJECTED) {
        doc.status = DriverDocumentBundleStatus.DRAFT;
      }

     const document =  await this.repository.save(doc);

      return {
        driverDocument: document,
        success: true,
        message: Message(lang, "DRIVER_DOCUMENT.FILE_UPLOADED_SUCCESS"),
      };
    } catch (e) {
      console.log(e);
      
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─── Submit for review ────────────────────────────────────────────────────────
  async submitForReview(
    driverId: string,
    input: SubmitDocumentForReviewInput,
  ) {
    const doc = await this.repository.findByDriverAndType(
      driverId,
      input.documentType,
    );

    if (!doc) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }

    if (doc.status === DriverDocumentBundleStatus.PENDING_REVIEW) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.ALREADY_SUBMITTED",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (doc.status === DriverDocumentBundleStatus.APPROVED) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.ALREADY_APPROVED",
        HttpStatus.BAD_REQUEST,
      );
    }

    const required = REQUIRED_SIDES[input.documentType];

    const activeSides = doc.files
      .filter((f) => f.isActive)
      .map((f) => f.side);

    const missingSides = required.filter(
      (s) => !activeSides.includes(s),
    );

    if (missingSides.length) {
      ErrorException(
        null,
        `DRIVER_DOCUMENT.MISSING_SIDES: ${missingSides.join(", ")}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    doc.status = DriverDocumentBundleStatus.PENDING_REVIEW;
    doc.submittedAt = new Date();

    await this.repository.save(doc);

    return doc;
  }

  // ─── Get my docs ──────────────────────────────────────────────────────────────
  async getMyDocuments(driverId: string) {
    return this.repository.getDriverDocuments(driverId);
  }

  // ─── Driver URL ───────────────────────────────────────────────────────────────
  async getDocumentViewUrl(params: {
    driverId: string;
    documentType: DriverDocumentType;
    side: DriverDocumentSide;
  }) {
    const doc = await this.repository.findByDriverAndType(
      params.driverId,
      params.documentType,
    );

    if (!doc) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }

    const file = doc.files.find(
      (f) => f.side === params.side && f.isActive,
    );

    if (!file) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.FILE_NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }

    const url = await this.s3.getViewUrl(
      file.s3Key,
      VIEW_URL_EXPIRES_DRIVER_SECONDS,
    );

    return {
      url,
      expiresInSeconds: VIEW_URL_EXPIRES_DRIVER_SECONDS,
    };
  }

  // ─── Admin URL ────────────────────────────────────────────────────────────────
  async getDocumentViewUrlAsAdmin(params: {
    driverId: string;
    documentType: DriverDocumentType;
    side: DriverDocumentSide;
  }) {
    const doc = await this.repository.findByDriverAndType(
      params.driverId,
      params.documentType,
    );

    if (!doc) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }

  
    const file = findActiveFileBySide(doc, params.side);

    if (!file) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.FILE_NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }

    const url = await this.s3.getViewUrl(
      file.s3Key,
      VIEW_URL_EXPIRES_ADMIN_SECONDS,
    );

    return {
      url,
      expiresInSeconds: VIEW_URL_EXPIRES_ADMIN_SECONDS,
    };
  }

  // ─── Approve ──────────────────────────────────────────────────────────────────
  async approveDocument(params: {
    documentId: string;
    adminId: string;
  }) {
    const doc = await this.repository.findById(new Types.ObjectId(params.documentId));

    if (!doc) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }

    doc.status = DriverDocumentBundleStatus.APPROVED;
    doc.reviewedBy = new Types.ObjectId(params.adminId) as any;
    doc.reviewedAt = new Date();

    await this.repository.save(doc);

    return doc;
  }

  // ─── Reject ───────────────────────────────────────────────────────────────────
  async rejectDocument(params: {
    documentId: string;
    adminId: string;
    rejectionReason: string;
  }) {
    const doc = await this.repository.findById(new Types.ObjectId(params.documentId));

    if (!doc) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }

    doc.status = DriverDocumentBundleStatus.REJECTED;
    doc.reviewedBy = new Types.ObjectId(params.adminId) as any;
    doc.reviewedAt = new Date();
    doc.rejectionReason = params.rejectionReason;

    await this.repository.save(doc);

    return doc;
  }

  // ─── Midnight cron cleanup ────────────────────────────────────────────────────
  async deleteInactiveFiles(): Promise<void> {
    const docs = await this.repository.findDocumentsWithInactiveFiles();

    for (const doc of docs) {
      const inactiveFiles = doc.files.filter((f) => !f.isActive);

      for (const file of inactiveFiles) {
        try {
          await this.s3.deleteObject(file.s3Key);
        } catch (e) {
          console.error(
            `Failed to delete S3 key ${file.s3Key}:`,
            e,
          );
        }
      }

      doc.files = doc.files.filter((f) => f.isActive);

      await this.repository.save(doc);
    }
  }
}