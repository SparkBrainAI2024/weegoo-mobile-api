import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { DriverDocument, DriverDocumentDocument } from "../../../../../libs/data-access/entities/driver-document.entity";
import { DriverDocumentBundleStatus, DriverDocumentType } from "@driver-api/enums/driver-document.enum";
import { BaseModel, BaseRepository } from "@libs/data-access";

@Injectable()
export class DriverDocumentRepository extends BaseRepository<DriverDocumentDocument> {
  constructor(
    @InjectModel(DriverDocument.name)
    private readonly _model: BaseModel<DriverDocumentDocument>,
  ) {
    super(_model);
  }

  findByDriverAndType(driverId: string, type: DriverDocumentType) {
    return this.model.findOne({
      driverId: new Types.ObjectId(driverId),
      type,
    });
  }

  getDriverDocuments(driverId: string) {
    return this.model.find({
      driverId: new Types.ObjectId(driverId),
    });
  }

  findDocumentsWithInactiveFiles() {
    return this.model.find({
      "files.isActive": false,
    });
  }

  createDraftDocument(driverId: string, type: DriverDocumentType) {
    return this.model.create({
      driverId: new Types.ObjectId(driverId),
      type,
      files: [],
      status: DriverDocumentBundleStatus.DRAFT,
    });
  }
}