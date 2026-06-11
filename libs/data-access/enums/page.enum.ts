import { registerEnumType } from '@nestjs/graphql';

export enum PageType {
  LEGAL = 'LEGAL',
  INFO = 'INFO',
}

export enum PageStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

registerEnumType(PageType, {
  name: 'PageType',
  description: 'Type of the page',
});

registerEnumType(PageStatus, {
  name: 'PageStatus',
  description: 'Publication status of the page',
});