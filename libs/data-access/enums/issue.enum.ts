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
  PAYMENT = 'PAYMENT',
  ACCOUNT = 'ACCOUNT',
  OTHER = 'OTHER',
}
 

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