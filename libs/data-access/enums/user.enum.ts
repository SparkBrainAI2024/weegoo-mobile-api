import { registerEnumType } from '@nestjs/graphql';

export enum roles {
  USER = "USER",
  ADMIN = "ADMIN",
  RIDER = "RIDER",
}

export enum language {
  EN = "EN",
  NP = "NP",
}

export enum GenderEnum {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHERS = "OTHERS",
  UNPUBLISHED = "UNPUBLISHED",
}

export enum verificationType {
  EMAIL = "EMAIL",
  PHONE = "PHONE",
  GOOGLE = "GOOGLE",
  APPLE = "APPLE",
}

export enum deviceType {
  IOS = "IOS",
  ANDROID = "ANDROID",
  WEB = "WEB",
}

export enum AuthProvider {
  PHONE = 'phone',
  GOOGLE = 'google',
  APPLE = 'apple',
}

export enum UserType {
  ADMIN = 'admin',
  USER = 'user',
  DRIVER = 'driver',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum bookingStatus {
  AVAILABLE = "AVAILABLE",
  RENTED = "RENTED",
  UNAVAILABLE = "UNAVAILABLE",
}


registerEnumType(UserStatus, {
  name: 'UserStatus',
  description: 'The status of the user',
  valuesMap: {
    ACTIVE: {
      description: 'The user is active',
    },
    INACTIVE: {
      description: 'The user is disabled',
    },
  },
});


registerEnumType(roles, {
  name: 'UserRole',
  description: 'The role of the user in the system',
  valuesMap: {
    RIDER: {
      description: 'Driver user with riding request acceptance permissions and transaction and wallet access',
    },
    USER: {
      description: 'Regular user with standard access',
    },
    ADMIN: {
      description: 'User with admin privileges',
    },
  },
});

registerEnumType(AuthProvider, {
  name: 'AuthProvider',
  description: 'The authentication provider used by the user',
  valuesMap: {
    PHONE: {
      description: 'User authenticated via phone number',
    },
    GOOGLE: {
      description: 'User authenticated via Google OAuth',
    },
    APPLE: {
      description: 'User authenticated via Apple OAuth',
    },
  },
});

registerEnumType(UserType, {
  name: 'UserType',
  description: 'The type of user in the system',
  valuesMap: {
    ADMIN: {
      description: 'User with admin privileges',
    },
    USER: {
      description: 'Regular user with standard access',
    },
    DRIVER: {
      description: 'Driver user with riding request acceptance permissions and transaction and wallet access',
    },
  },
});

registerEnumType(bookingStatus, {
  name: 'BookingStatus',
  description: 'The status of a booking',
  valuesMap: {
    AVAILABLE: {
      description: 'The booking is available',
    },
    RENTED: {
      description: 'The booking is currently rented',
    },
    UNAVAILABLE: {
      description: 'The booking is unavailable',
    },
  },
});


registerEnumType(language, { name: "Language" });
registerEnumType(GenderEnum, { name: "GenderEnum" });
registerEnumType(verificationType, { name: "VerificationType" });
registerEnumType(deviceType, { name: "DeviceType" });