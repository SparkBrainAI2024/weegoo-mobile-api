// promo-code.messages.ts
export const PROMO_CODE = {
  // Not found
  NOT_FOUND: (id: string) => `Promo code with id "${id}" not found`,

  // Conflicts
  NAME_ALREADY_EXISTS: (name: string) =>
    `An active promo code with name "${name}" already exists`,

  // Status transition errors
  EXPIRED_NO_EDIT: 'Expired promo codes cannot be edited',
  INACTIVE_NO_EDIT:
    'Inactive promo codes cannot be edited. Create a new promo code instead',
  ACTIVE_LIMITED_EDIT:
    'Active promo codes only allow updating startDateTime and expiryDateTime. To change other fields, deactivate first and create a new promo code',
  NO_VALID_FIELDS: 'No valid fields provided for update',
  ACTIVATE_ONLY_DRAFT: (status: string) =>
    `Only DRAFT promo codes can be activated. Current status: ${status}`,
  DEACTIVATE_ONLY_ACTIVE: (status: string) =>
    `Only ACTIVE promo codes can be deactivated. Current status: ${status}`,
  DELETE_ONLY_DRAFT:
    'Only DRAFT promo codes can be deleted. Use deactivate for ACTIVE codes',
};