import { DocumentFile } from "@libs/data-access/entities/document-file.embedded";
import { DriverDocument } from "@libs/data-access/entities/driver-document.entity";

import { DriverDocumentSide } from "@libs/data-access/enums/driver-document.enum";

export const checkDuplicateInArray = (array: any[any], field: string) => {
  var valueArr = array.map(function (item) {
    return item[field];
  });
  return valueArr.some(function (item, idx) {
    return valueArr.indexOf(item) != idx;
  });
};

// utils/document-file.util.ts

export function deactivateSideFiles<T extends { side: string; isActive: boolean }>(
  files: T[],
  side: string,
): T[] {
  return files.map((f) =>
    f.side === side && f.isActive
      ? { ...f, isActive: false }
      : f,
  );
}


export const findActiveFileBySide = (
  doc: DriverDocument,
  side: DriverDocumentSide,
): DocumentFile | undefined =>
  doc.files.find((f) => f.side === side && f.isActive);