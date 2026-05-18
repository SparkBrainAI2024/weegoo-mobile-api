import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from "class-validator";
import {
  DriverDocumentType,
  DriverDocumentSide,
} from "../enums/driver-document.enum";

// ─── Allowed sides per document type ─────────────────────────────────────────

const ALLOWED_SIDES: Record<DriverDocumentType, DriverDocumentSide[]> = {
  [DriverDocumentType.NATIONAL_ID]: [
    DriverDocumentSide.FRONT,
    DriverDocumentSide.BACK,
  ],
  [DriverDocumentType.DRIVING_LICENSE]: [
    DriverDocumentSide.FRONT,
    DriverDocumentSide.BACK,
  ],
  [DriverDocumentType.BLUEBOOK]: [
    DriverDocumentSide.FRONT,
    DriverDocumentSide.VEHICLE_INFO_PAGE,
    DriverDocumentSide.TAX_CLEARANCE_PAGE,
  ],
};

// ─── Validator ────────────────────────────────────────────────────────────────

export function IsValidDocumentSide(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name:   "isValidDocumentSide",
      target:  object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(side: DriverDocumentSide, args: ValidationArguments) {
          const input = args.object as { documentType?: DriverDocumentType };
          const docType = input.documentType;

          if (!docType || !ALLOWED_SIDES[docType]) return false;

          return ALLOWED_SIDES[docType].includes(side);
        },

        defaultMessage(args: ValidationArguments) {
             return "DRIVER_DOCUMENT.INVALID_SIDE_FOR_TYPE"; 
        
        },
      },
    });
  };
}