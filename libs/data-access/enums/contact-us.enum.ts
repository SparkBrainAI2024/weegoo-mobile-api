import { registerEnumType } from '@nestjs/graphql';

export enum ContactUsStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  INACTIVE = 'INACTIVE',
}

registerEnumType(ContactUsStatus, {
  name: 'ContactUsStatus',
  description: 'The status of a contact us message',
  valuesMap: {
    ACTIVE: { description: 'The message is active and pending review' },
    RESOLVED: { description: 'The message has been resolved' },
    INACTIVE: { description: 'The message has been deactivated' },
  },
});