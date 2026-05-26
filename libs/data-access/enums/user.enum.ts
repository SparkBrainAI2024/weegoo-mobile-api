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
  VERIFICATION_PHONE = "VERIFICATION_PHONE",
  RESET_PASSWORD = "RESET_PASSWORD",
  VERIFICATION_EMAIL = "VERIFICATION_EMAIL",
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

export enum ridePreference {
  SCHEDULED = "SCHEDULED",
  INSTANT = "INSTANT",
  BOTH='BOTH',
}

export enum DriverOnlineStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
}


registerEnumType(DriverOnlineStatus, {
  name: 'DriverOnlineStatus',
  description: 'The online status of the driver',
  valuesMap: {
    ONLINE: {
      description: 'The driver is online',
    },
    OFFLINE: {
      description: 'The driver is offline',
    },
  },
});

export enum ProvinceEnum {
  PROVINCE_1 = "KOSHI",
  PROVINCE_2 = "MADESH",
  BAGMATI = "BAGMATI",
  GANDAKI = "GANDAKI",
  LUMBINI = "LUMBINI",
  KARNALI = "KARNALI",
  SUDURPASHCHIM = "SUDURPASHCHIM",
}



registerEnumType(ridePreference, {
  name: 'RidePreference',
  description: 'The preference for booking a ride',
  valuesMap: {
    SCHEDULED: {
      description: 'The ride is scheduled for a later time',  
    },
    INSTANT: {
      description: 'The ride is requested for immediate pickup',
    },
  },
});

registerEnumType(ProvinceEnum, {
  name: 'ProvinceEnum',
  description: 'The provinces of Nepal',
  valuesMap: {
    PROVINCE_1: {
      description: 'Province No. 1 (Koshi)',
    },
    PROVINCE_2: {
      description: 'Province No. 2 (Madhesh)',
    },
    BAGMATI: {
      description: 'Bagmati Province',
    },
    GANDAKI: {
      description: 'Gandaki Province',
    },
    LUMBINI: {
      description: 'Lumbini Province',
    },
    KARNALI: {
      description: 'Karnali Province',
    },
    SUDURPASHCHIM: {
      description: 'Sudurpashchim Province',
    },
  },
});

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