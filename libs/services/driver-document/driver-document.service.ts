import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Types } from "mongoose";

import {
  deactivateSideFiles,
  ErrorException,
  findActiveFileBySide,
  REQUIRED_SIDES,
} from "@libs/common";
import { S3Service } from "@libs/s3";

import {
  VIEW_URL_EXPIRES_ADMIN_SECONDS,
  VIEW_URL_EXPIRES_DRIVER_SECONDS,
} from "@libs/s3/s3.constants";

import { DocumentFileStatus } from "@libs/data-access/enums/upload.enum";

import { UpsertDocumentFileInput } from "@libs/data-access/dtos/input/upsert-document-file.input";
import {
  DriverDocumentBundleStatus,
  DriverDocumentSide,
  DriverDocumentType,
} from "@libs/data-access/enums/driver-document.enum";
import { Message } from "@libs/localization";
import { BasicResponse } from "@libs/data-access/dtos/response/basic.response";
import { log } from "console";
import { DriverDocumentConfirmUploadResponse } from "@libs/data-access/dtos/response/driver-document-confirm-upload.response";
import { SubmitDocumentForReviewInput } from "@libs/data-access/dtos/input/submit-for-review.input";
import { DriverDocumentRepository } from "@libs/data-access/repositories/driver-document.repository";
import {
  BaseModel,
  DriverDocument,
  DriverDocumentDocument,
} from "@libs/data-access";
import { InjectModel } from "@nestjs/mongoose";

@Injectable()
export class DriverDocumentService {
  constructor(
    private readonly repository: DriverDocumentRepository,
    private readonly s3: S3Service,
    @InjectModel(DriverDocument.name)
    private readonly _model: BaseModel<DriverDocumentDocument>,
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

      if (!doc) {
        const document = await this.repository.save({
          driverId: new Types.ObjectId(driverId),
          type: input.documentType,
          status: DriverDocumentBundleStatus.PENDING,
          files: [
            {
              side: input.side,
              s3Key: input.s3Key,
              isActive: true,
              status: DocumentFileStatus.PENDING,
              verifiedBy: null,
              verifiedAt: null,
              createdAt: new Date(),
            },
          ],
          submittedAt: new Date(),
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
        });

        return {
          driverDocument: document,
          success: true,
          message: Message(lang, "DRIVER_DOCUMENT.FILE_UPLOADED_SUCCESS"),
        };
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
        doc.status = DriverDocumentBundleStatus.PENDING;
      }

      const document = await this.repository.save(doc);

      return {
        driverDocument: document,
        success: true,
        message: Message(lang, "DRIVER_DOCUMENT.FILE_UPLOADED_SUCCESS"),
      };
    } catch (e) {
      ErrorException(
        e,
        "COMMON.INTERNAL_SERVER_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─── Submit for review ────────────────────────────────────────────────────────
  async submitForReview(driverId: string, input: SubmitDocumentForReviewInput) {
    const doc = await this.repository.findByDriverAndType(
      driverId,
      input.documentType,
    );

    if (!doc) {
      ErrorException(null, "DRIVER_DOCUMENT.NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    if (doc.status === DriverDocumentBundleStatus.PENDING) {
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

    const activeSides = doc.files.filter((f) => f.isActive).map((f) => f.side);

    const missingSides = required.filter((s) => !activeSides.includes(s));

    if (missingSides.length) {
      ErrorException(
        null,
        `DRIVER_DOCUMENT.MISSING_SIDES: ${missingSides.join(", ")}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    doc.status = DriverDocumentBundleStatus.PENDING;
    doc.submittedAt = new Date();

    await this.repository.save(doc);

    return doc;
  }

  // ─── Get my docs ──────────────────────────────────────────────────────────────
  async getMyDocuments(driverId: string) {
    const myDocs = await this.repository.getDriverDocuments(driverId);

    return myDocs.map((doc) => ({
      ...doc.toObject(),
      files: doc.files.filter((f) => f.isActive),
    }));
  }

  private toObjectId(id: string, label = "id"): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label}: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  private async findBundleByFileId(
    documentFileId: string,
  ): Promise<DriverDocumentDocument> {
    const fileObjectId = this.toObjectId(documentFileId, "documentFileId");

    const bundle = await this._model.findOne({
      "files._id": fileObjectId,
    });

    if (!bundle) {
      throw new NotFoundException(
        `No document bundle found containing file ${documentFileId}`,
      );
    }
    return bundle;
  }

  async approveDocumentFile(
    documentFileId: string,
    adminId: string,
  ): Promise<DriverDocumentDocument> {
    const bundle = await this.findBundleByFileId(documentFileId);
    const file = bundle.files.find((f) => f._id?.toString() === documentFileId);

    if (!file)
      throw new NotFoundException(`File ${documentFileId} not found in bundle`);
    if (!file.isActive)
      throw new BadRequestException("Cannot approve an inactive file");
    if (file.status === DocumentFileStatus.VERIFIED) {
      throw new BadRequestException("File is already verified");
    }

    file.status = DocumentFileStatus.VERIFIED;
    file.verifiedBy = adminId;
    file.verifiedAt = new Date();

    const activeFiles = bundle.files.filter((f) => f.isActive);
    const allActiveApproved =
      activeFiles.length > 0 &&
      activeFiles.every((f) => f.status === DocumentFileStatus.VERIFIED);

    if (allActiveApproved) {
      bundle.status = DriverDocumentBundleStatus.APPROVED;
      bundle.reviewedBy = this.toObjectId(adminId, "adminId");
      bundle.reviewedAt = new Date();
      bundle.rejectionReason = null;
    }
    // else: leave bundle.status as-is — still waiting on other side(s)

    await bundle.save();
    return bundle;
  }

  async rejectDocumentFile(
    documentFileId: string,
    adminId: string,
    rejectionReason: string,
  ): Promise<DriverDocumentDocument> {
    const bundle = await this.findBundleByFileId(documentFileId);
    const file = bundle.files.find((f) => f._id?.toString() === documentFileId);

    if (!file)
      throw new NotFoundException(`File ${documentFileId} not found in bundle`);
    if (!file.isActive)
      throw new BadRequestException("Cannot reject an inactive file");
    if (file.status === DocumentFileStatus.REJECTED) {
      throw new BadRequestException("File is already rejected");
    }

    file.status = DocumentFileStatus.REJECTED;
    file.verifiedBy = adminId;
    file.verifiedAt = new Date();
    file.rejectionReason = rejectionReason;

    const activeFiles = bundle.files.filter((f) => f.isActive);
    const allActiveRejected =
      activeFiles.length > 0 &&
      activeFiles.every((f) => f.status === DocumentFileStatus.REJECTED);

    if (allActiveRejected) {
      bundle.status = DriverDocumentBundleStatus.REJECTED;
      bundle.reviewedBy = this.toObjectId(adminId, "adminId");
      bundle.reviewedAt = new Date();
    }

    await bundle.save();
    return bundle;
  }
  async getDriverDocuments(driverId: string) {
    const myDocs = await this.repository.getDriverDocuments(driverId);

    const docsWithUrls = await Promise.all(
      myDocs.map(async (doc) => {
        const files = await Promise.all(
          doc.files
            .filter((file) => file.isActive)
            .map(async (file) => {
              const rawKey = file.s3Key;

              const [viewUrl, downloadUrl] = await Promise.all([
                this.s3.getViewUrl(rawKey, VIEW_URL_EXPIRES_ADMIN_SECONDS),
                this.s3.getDownloadUrl(
                  rawKey,
                  VIEW_URL_EXPIRES_ADMIN_SECONDS,
                  `${doc.type}_${file.side}.${rawKey.split(".").pop()}`,
                ),
              ]);

              return {
                _id: file._id?.toString(),
                side: file.side,
                isActive: file.isActive,
                status: file.status,
                verifiedBy: file.verifiedBy,
                verifiedAt: file.verifiedAt,
                createdAt: file.createdAt,
                s3Key: viewUrl,
                downloadUrl,
              };
            }),
        );

        return {
          _id: doc._id?.toString(),
          type: doc.type,
          status: doc.status,
          rejectionReason: doc.rejectionReason,
          reviewedBy: doc.reviewedBy?.toString(),
          reviewedAt: doc.reviewedAt,
          submittedAt: doc.submittedAt,
          files,
        };
      }),
    );

    return docsWithUrls;
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
      ErrorException(null, "DRIVER_DOCUMENT.NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    const file = doc.files.find((f) => f.side === params.side && f.isActive);

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
      ErrorException(null, "DRIVER_DOCUMENT.NOT_FOUND", HttpStatus.NOT_FOUND);
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

  async getDocumentDownloadUrlAsAdmin(params: {
    driverId: string;
    documentType: DriverDocumentType;
    side: DriverDocumentSide;
  }) {
    const doc = await this.repository.findByDriverAndType(
      params.driverId,
      params.documentType,
    );

    if (!doc) {
      ErrorException(null, "DRIVER_DOCUMENT.NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    const file = findActiveFileBySide(doc, params.side);

    if (!file) {
      ErrorException(
        null,
        "DRIVER_DOCUMENT.FILE_NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }

    // e.g. "driver_license_FRONT.jpg" — derive extension from the stored key
    const ext = file.s3Key.split(".").pop();
    const filename = `${params.documentType}_${params.side}.${ext}`;

    const url = await this.s3.getDownloadUrl(
      file.s3Key,
      VIEW_URL_EXPIRES_ADMIN_SECONDS, // reuse, or add a separate DOWNLOAD_URL_EXPIRES_ADMIN_SECONDS if you want a different TTL
      filename,
    );

    return {
      url,
      expiresInSeconds: VIEW_URL_EXPIRES_ADMIN_SECONDS,
    };
  }

  // ─── Approve ──────────────────────────────────────────────────────────────────
  async approveDocument(params: { documentId: string; adminId: string }) {
    const doc = await this.repository.findById(
      new Types.ObjectId(params.documentId),
    );

    if (!doc) {
      ErrorException(null, "DRIVER_DOCUMENT.NOT_FOUND", HttpStatus.NOT_FOUND);
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
    const doc = await this.repository.findById(
      new Types.ObjectId(params.documentId),
    );

    if (!doc) {
      ErrorException(null, "DRIVER_DOCUMENT.NOT_FOUND", HttpStatus.NOT_FOUND);
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
          console.error(`Failed to delete S3 key ${file.s3Key}:`, e);
        }
      }

      doc.files = doc.files.filter((f) => f.isActive);

      await this.repository.save(doc);
    }
  }
}
