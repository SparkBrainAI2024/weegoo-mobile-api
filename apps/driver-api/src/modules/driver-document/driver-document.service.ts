import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { ErrorException } from "@libs/common";
import { S3Service } from "@libs/s3";

import {
  VIEW_URL_EXPIRES_ADMIN_SECONDS,
  VIEW_URL_EXPIRES_DRIVER_SECONDS,
} from "@libs/s3/s3.constants";

import { DocumentFileStatus } from "@libs/data-access/enums/upload.enum";


import { UpsertDocumentFileInput } from "./dto/upsert-document-file.input";
import { SubmitDocumentForReviewInput } from "./dto/submit-for-review.input";
import { DriverDocumentRepository } from "../../../../../libs/data-access/repositories/driver-document.repository";
import { DriverDocumentBundleStatus, DriverDocumentSide, DriverDocumentType } from "@driver-api/enums/driver-document.enum";
import { REQUIRED_SIDES } from "@driver-api/constants/required-sides.constant";



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
  ) {
    let doc = await this.repository.findByDriverAndType(
      driverId,
      input.documentType,
    );

    if (!doc) {
      doc = await this.repository.createDraftDocument(
        driverId,
        input.documentType,
      );
    }

    if (doc.status === DriverDocumentBundleStatus.APPROVED) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.ALREADY_APPROVED",
        HttpStatus.BAD_REQUEST,
      );
    }

    // mark previous active side inactive
    doc.files = doc.files.map((f) =>
      f.side === input.side && f.isActive
        ? {
            ...f,
            isActive: false,
          }
        : f,
    );

    // add new active file
    doc.files.push({
      side: input.side,
      s3Key: input.s3Key,
      isActive: true,
      status: DocumentFileStatus.PENDING,
      verifiedBy: null,
      verifiedAt: null,
      createdAt: new Date(),
    });

    if (doc.status === DriverDocumentBundleStatus.REJECTED) {
      doc.status = DriverDocumentBundleStatus.DRAFT;
    }

    await this.repository.save(doc);

    return doc;
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
    const doc = await this.repository.findById(params.documentId);

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
    const doc = await this.repository.findById(params.documentId);

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