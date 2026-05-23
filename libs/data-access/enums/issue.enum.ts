import { registerEnumType } from "@nestjs/graphql";

export enum ReportedByType {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
}

export enum IssueCategory {
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  DRIVER_BEHAVIOR = 'DRIVER_BEHAVIOR',
  PASSENGER_BEHAVIOR = 'PASSENGER_BEHAVIOR',
  APP_BUG = 'APP_BUG',
  RIDE_ISSUE = 'RIDE_ISSUE',
  OTHER = 'OTHER',
}

export enum IssueStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
}

registerEnumType(IssueCategory, { name: 'IssueCategory' });
registerEnumType(IssueStatus, { name: 'IssueStatus' });
registerEnumType(ReportedByType, {
  name: 'ReportedByType',
  description: 'The type of the user who reported the issue since driver and passenger are allowed to report issues',
  valuesMap: {
    DRIVER: {
      description: 'The user is a driver',
    },
    PASSENGER: {
      description: 'The user is a passenger',
    },
  },
});