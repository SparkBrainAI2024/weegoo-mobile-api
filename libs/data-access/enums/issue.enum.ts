import { registerEnumType } from "@nestjs/graphql";

export enum ReportedByType {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
}


export enum IssueStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
}


// Top-level parent categories — these are seeded, not dynamic
export enum IssueParentCategory {
  RIDE = 'RIDE',
  CANCEL = 'CANCEL',
  COMPLAINT = 'COMPLAINT',
  CHAT = 'CHAT',
 
}

export enum IssueCategoryFor {
  DRIVER = 'DRIVER',
  PASSENGER = 'PASSENGER',
  BOTH = 'BOTH',
}

registerEnumType(IssueCategoryFor, {
  name: 'IssueCategoryFor',
  description: 'Indicates whether an issue category is applicable to drivers, passengers, or both',
  valuesMap: {
    DRIVER: { description: 'Category is relevant for drivers' },
    PASSENGER: { description: 'Category is relevant for passengers' },
    BOTH: { description: 'Category is relevant for both drivers and passengers' },
  },
});
 

registerEnumType(IssueParentCategory, {
  name: 'IssueParentCategory',
  description: 'Top-level grouping for issue templates',
  valuesMap: {
    RIDE: { description: 'Problems that occurred during a ride' },
    CANCEL: { description: 'Issues related to ride cancellations' },
    COMPLAINT: { description: 'Complaints about drivers, passengers, or service' },
    CHAT: { description: 'Problems with the in-app chat feature' },

  },
});


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