import { registerEnumType } from '@nestjs/graphql';

export enum DiscountTypeEnum {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

export enum AppliedToEnum {
  ALL_RIDES = 'ALL_RIDES',
  INSTANT = 'INSTANT',
  SCHEDULED = 'SCHEDULED',
}

export enum PromoCodeStatusEnum {
  DRAFT='DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
}

registerEnumType(DiscountTypeEnum, {
  name: 'DiscountTypeEnum',
  description: 'Type of discount (percentage or flat amount)',
});

registerEnumType(AppliedToEnum, {
  name: 'AppliedToEnum',
  description: 'To which ride types the promo code applies',
});

registerEnumType(PromoCodeStatusEnum, {
  name: 'PromoCodeStatusEnum',
  description: 'Status of the promo code',
});