import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { DriverDocument, DriverDocumentDocument } from "../entities/driver-document.entity";
import { BaseModel, BaseRepository } from "@libs/data-access";
import { DriverDocumentBundleStatus, DriverDocumentType } from "../enums/driver-document.enum";

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


  save(doc: DriverDocumentDocument) {
  return this.model.create(doc);
}
}