import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DriverDocument, DriverDocumentDocument } from "./entities/driver-document.entity";
import { DriverDocumentBundleStatus, DriverDocumentType } from "@driver-api/enums/driver-document.enum";


@Injectable()
export class DriverDocumentRepository {
  constructor(
    @InjectModel(DriverDocument.name)
    private readonly docModel: Model<DriverDocumentDocument>,
  ) {}

  findOne(filter: any) {
    return this.docModel.findOne(filter);
  }

  findById(id: string) {
    return this.docModel.findById(id);
  }

  findByDriverAndType(driverId: string, type: DriverDocumentType) {
    return this.docModel.findOne({
      driverId: new Types.ObjectId(driverId),
      type,
    });
  }

  create(data: Partial<DriverDocument>) {
    return this.docModel.create(data);
  }

  save(doc: DriverDocumentDocument) {
    return doc.save();
  }

  getDriverDocuments(driverId: string) {
    return this.docModel.find({
      driverId: new Types.ObjectId(driverId),
    });
  }

  findDocumentsWithInactiveFiles() {
    return this.docModel.find({
      "files.isActive": false,
    });
  }

  createDraftDocument(driverId: string, type: DriverDocumentType) {
    return this.docModel.create({
      driverId: new Types.ObjectId(driverId),
      type,
      files: [],
      status: DriverDocumentBundleStatus.DRAFT,
    });
  }
}